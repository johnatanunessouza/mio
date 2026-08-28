import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { run } from '../../utils/exec.js';
import { mergeJsonFile } from '../../utils/json-file.js';
import { installSkillForAgents } from '../skills/install.js';
import { ensureBinary } from './binary.js';
import type { ToolDefinition, ToolInstallContext, ToolInstallStep, ToolInstaller } from './types.js';

export const CODEGRAPH_SKILL_NAME = 'codegraph';

/** Agents whose MCP config mio writes into the project instead of the user home. */
const COPILOT_AGENT_ID = 'github-copilot';

const definition: ToolDefinition = {
  id: 'codegraph',
  name: 'CodeGraph',
  description: 'Local symbol/call graph so agents explore code without grep loops',
  binary: 'codegraph',
  npmPackage: '@colbymchenry/codegraph',
};

const gitignoreContent = `# CodeGraph data files — local to each machine, not for committing.
# Ignore everything in .codegraph/ except this file itself, so transient
# files (the database, daemon.pid, sockets, logs) never show up in git.
*
!.gitignore
`;

/** Keep `.codegraph/` (a large local SQLite index) out of version control. */
async function writeIndexGitignore(projectRoot: string, dryRun = false): Promise<ToolInstallStep> {
  const target = path.join(projectRoot, '.codegraph', '.gitignore');
  let existing: string | undefined;
  try {
    existing = await readFile(target, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (existing === gitignoreContent) {
    return { label: '.codegraph/.gitignore', status: 'skipped', detail: 'already up to date' };
  }
  if (dryRun) {
    return { label: '.codegraph/.gitignore', status: 'skipped', detail: `dry run: would write ${target}` };
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, gitignoreContent, 'utf8');
  return { label: '.codegraph/.gitignore', status: 'done', detail: target };
}

/**
 * Copilot has no `codegraph install` target, so mio writes the workspace MCP
 * config by hand. Copilot reads it from two places, one per surface:
 * `.vscode/mcp.json` (key `servers`) for Copilot Chat in VS Code, and
 * `.github/mcp.json` (key `mcpServers`) for the Copilot CLI.
 *
 * Both live inside a directory the agent owns. The CLI also accepts a root
 * `.mcp.json`, but that path is shared with Claude Code and other agents, so
 * writing it would register the server for agents the user never selected.
 */
const COPILOT_MCP_TARGETS = [
  { label: 'Copilot MCP (VS Code)', file: ['.vscode', 'mcp.json'], key: 'servers', withTools: false },
  { label: 'Copilot MCP (CLI)', file: ['.github', 'mcp.json'], key: 'mcpServers', withTools: true },
] as const;

/** Where mio wrote the Copilot CLI config before it moved under `.github/`. */
const LEGACY_ROOT_MCP = '.mcp.json';

/**
 * Earlier versions wrote the CLI config to the shared root `.mcp.json`. Report
 * a leftover so the user can drop it, rather than editing a file that other
 * agents may now depend on.
 */
async function detectLegacyRootMcp(projectRoot: string): Promise<ToolInstallStep | undefined> {
  const target = path.join(projectRoot, LEGACY_ROOT_MCP);
  let raw: string;
  try {
    raw = await readFile(target, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const servers = (parsed as { mcpServers?: Record<string, unknown> } | null)?.mcpServers;
  if (!servers || typeof servers !== 'object' || !('codegraph' in servers)) return undefined;

  return {
    label: 'legacy root MCP',
    status: 'skipped',
    detail: `${target} still declares codegraph — mio now writes .github/mcp.json; remove the root entry so only one config is live`,
  };
}

async function writeCopilotMcpConfig(projectRoot: string, command: string, dryRun = false): Promise<ToolInstallStep[]> {
  const server = { type: 'stdio', command, args: ['serve', '--mcp'] };
  const steps: ToolInstallStep[] = [];

  for (const target of COPILOT_MCP_TARGETS) {
    const file = path.join(projectRoot, ...target.file);
    const entry = target.withTools ? { ...server, tools: ['*'] } : server;
    if (dryRun) {
      steps.push({ label: target.label, status: 'skipped', detail: `dry run: would declare codegraph in ${file}` });
      continue;
    }
    const { changed } = await mergeJsonFile(file, { [target.key]: { codegraph: entry } });
    steps.push({
      label: target.label,
      status: changed ? 'done' : 'skipped',
      detail: changed ? file : `${file} already declares codegraph`,
    });
  }

  const legacy = await detectLegacyRootMcp(projectRoot);
  if (legacy) steps.push(legacy);

  return steps;
}

async function install(context: ToolInstallContext): Promise<ToolInstallStep[]> {
  const steps: ToolInstallStep[] = [];
  const { binaryPath, step } = await ensureBinary(definition, context.dryRun);
  steps.push(step);

  const installed = await installSkillForAgents(CODEGRAPH_SKILL_NAME, context.agents, context.projectRoot);
  if (installed.length === 0) {
    steps.push({ label: 'codegraph skill', status: 'skipped', detail: 'no selected agent supports local skills' });
  }
  for (const entry of installed) {
    steps.push({
      label: `codegraph skill → ${entry.agent.name}`,
      status: entry.changed ? 'done' : 'skipped',
      detail: entry.changed ? entry.path : `${entry.path} already up to date`,
    });
  }

  steps.push(await writeIndexGitignore(context.projectRoot, context.dryRun));

  if (context.agents.some((agent) => agent.id === COPILOT_AGENT_ID)) {
    steps.push(...await writeCopilotMcpConfig(context.projectRoot, binaryPath ?? definition.binary, context.dryRun));
  }

  if (!binaryPath) {
    steps.push({
      label: 'index project',
      status: 'skipped',
      detail: context.dryRun ? 'dry run' : 'codegraph unavailable — run `codegraph init` once it is installed',
    });
    return steps;
  }

  if (context.dryRun) {
    steps.push({ label: 'index project', status: 'skipped', detail: 'dry run: would run `codegraph init`' });
    return steps;
  }

  console.log(chalk.dim('  Indexing the project with codegraph (this can take a while on large repos)...'));
  const result = await run(binaryPath, ['init', context.projectRoot], { cwd: context.projectRoot, inherit: context.interactive });
  steps.push(result.code === 0
    ? { label: 'index project', status: 'done', detail: '`codegraph init` completed' }
    : { label: 'index project', status: 'failed', detail: `\`codegraph init\` exited with code ${result.code}${result.stderr.trim() ? `: ${result.stderr.trim().split('\n').at(-1)}` : ''}` });

  return steps;
}

export const codegraphInstaller: ToolInstaller = { definition, install };

/** Exported for tests: the MCP files mio writes when Copilot is selected. */
export const __testing = { writeCopilotMcpConfig, COPILOT_MCP_TARGETS, LEGACY_ROOT_MCP };
