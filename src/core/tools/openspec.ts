import chalk from 'chalk';
import { run } from '../../utils/exec.js';
import { setJsonValue } from '../../utils/json-file.js';
import { applyOpenspecGuidance } from '../openspec/config.js';
import { ensureBinary } from './binary.js';
import type { AgentDefinition } from '../agents/types.js';
import type { ToolDefinition, ToolInstallContext, ToolInstallStep, ToolInstaller } from './types.js';

const definition: ToolDefinition = {
  id: 'openspec',
  name: 'OpenSpec',
  description: 'Spec-driven development workflow (proposals, specs, tasks)',
  binary: 'openspec',
  npmPackage: 'openspec',
};

/**
 * mio agent ids → `openspec init --tools` ids. Identity mappings are omitted;
 * an id absent from both this table and `OPENSPEC_TOOL_IDS` has no OpenSpec
 * equivalent and is reported as unsupported rather than silently dropped.
 */
const AGENT_TO_OPENSPEC_TOOL: Readonly<Record<string, string>> = {
  devin: 'windsurf',
};

/** Tool ids accepted by `openspec init --tools`. */
const OPENSPEC_TOOL_IDS: ReadonlySet<string> = new Set([
  'amazon-q', 'antigravity', 'auggie', 'bob', 'claude', 'cline', 'codex', 'forgecode', 'codebuddy',
  'continue', 'costrict', 'crush', 'cursor', 'factory', 'gemini', 'github-copilot', 'iflow', 'junie',
  'kilocode', 'kimi', 'kiro', 'lingma', 'vibe', 'opencode', 'pi', 'qoder', 'qwen', 'roocode', 'trae',
  'windsurf',
]);

/** Every workflow the interactive `openspec config profile` picker can enable. */
const ALL_WORKFLOWS = [
  'propose', 'explore', 'new', 'continue', 'apply', 'ff', 'sync', 'archive', 'bulk-archive', 'verify', 'onboard',
] as const;

export interface MappedTools {
  tools: string[];
  unsupported: string[];
}

export function mapAgentsToOpenspecTools(agents: readonly AgentDefinition[]): MappedTools {
  const tools = new Set<string>();
  const unsupported: string[] = [];
  for (const agent of agents) {
    const mapped = AGENT_TO_OPENSPEC_TOOL[agent.id] ?? agent.id;
    if (OPENSPEC_TOOL_IDS.has(mapped)) tools.add(mapped);
    else unsupported.push(agent.id);
  }
  return { tools: [...tools].sort(), unsupported: unsupported.sort() };
}

/**
 * Put the global OpenSpec profile in the "everything selected" state the
 * interactive `openspec config profile` picker produces.
 *
 * `config set` handles the scalar keys but rejects arrays ("expected array,
 * received string") and the only preset shortcut, `core`, enables a subset —
 * so `workflows` is merged straight into the config JSON that `config path`
 * reports.
 */
async function configureProfile(binaryPath: string): Promise<ToolInstallStep[]> {
  const steps: ToolInstallStep[] = [];
  for (const [key, value] of [['profile', 'custom'], ['delivery', 'both']] as const) {
    const result = await run(binaryPath, ['config', 'set', key, value]);
    steps.push(result.code === 0
      ? { label: `profile ${key}`, status: 'done', detail: value }
      : { label: `profile ${key}`, status: 'failed', detail: `\`openspec config set ${key} ${value}\` exited with code ${result.code}` });
  }

  const pathResult = await run(binaryPath, ['config', 'path']);
  const configPath = pathResult.stdout.trim().split('\n').at(-1)?.trim();
  if (pathResult.code !== 0 || !configPath) {
    steps.push({ label: 'profile workflows', status: 'failed', detail: '`openspec config path` did not report a config file' });
    return steps;
  }

  try {
    const { changed } = await setJsonValue(configPath, 'workflows', [...ALL_WORKFLOWS]);
    steps.push({
      label: 'profile workflows',
      status: changed ? 'done' : 'skipped',
      detail: changed ? `${ALL_WORKFLOWS.length} workflows enabled` : 'all workflows already enabled',
    });
  } catch (error: unknown) {
    steps.push({ label: 'profile workflows', status: 'failed', detail: error instanceof Error ? error.message : String(error) });
  }
  return steps;
}

/**
 * Write the guidance the project's skills contribute into
 * `openspec/config.yaml`. Runs on every openspec install so a project that
 * already carries a contributing skill picks the rules up the moment OpenSpec
 * is generated, without waiting for the skill to be installed again.
 */
async function configureGuidance(context: ToolInstallContext): Promise<ToolInstallStep> {
  try {
    const result = await applyOpenspecGuidance({ projectRoot: context.projectRoot, dryRun: context.dryRun });
    if (result.reason === 'no-guidance') {
      return { label: 'config guidance', status: 'skipped', detail: 'no installed skill contributes guidance' };
    }
    if (result.reason === 'no-openspec-project') {
      return { label: 'config guidance', status: 'skipped', detail: 'no openspec/ directory to write config.yaml into' };
    }
    const summary = `${result.sections.join(', ')} — from: ${result.skillIds.join(', ')}`;
    if (context.dryRun) {
      return { label: 'config guidance', status: 'skipped', detail: `dry run: would write ${summary} to ${result.path}` };
    }
    return {
      label: 'config guidance',
      status: result.changed ? 'done' : 'skipped',
      detail: result.changed ? `${summary} (${result.path})` : `already up to date in ${result.path}`,
    };
  } catch (error: unknown) {
    return { label: 'config guidance', status: 'failed', detail: error instanceof Error ? error.message : String(error) };
  }
}

async function install(context: ToolInstallContext): Promise<ToolInstallStep[]> {
  const steps: ToolInstallStep[] = [];
  const { binaryPath, step } = await ensureBinary(definition, context.dryRun);
  steps.push(step);

  const { tools, unsupported } = mapAgentsToOpenspecTools(context.agents);
  if (unsupported.length > 0) {
    steps.push({
      label: 'unsupported agents',
      status: 'skipped',
      detail: `OpenSpec has no tool for: ${unsupported.join(', ')}`,
    });
  }

  if (tools.length === 0) {
    steps.push({ label: 'openspec init', status: 'skipped', detail: 'none of the selected agents map to an OpenSpec tool' });
    return steps;
  }

  if (context.dryRun) {
    steps.push({ label: 'openspec init', status: 'skipped', detail: `dry run: would run \`openspec init --tools ${tools.join(',')}\`` });
    steps.push({ label: 'profile', status: 'skipped', detail: 'dry run: would enable every workflow globally' });
    steps.push(await configureGuidance(context));
    return steps;
  }

  if (!binaryPath) {
    steps.push({
      label: 'openspec init',
      status: 'skipped',
      detail: `openspec unavailable — run \`openspec init --tools ${tools.join(',')}\` once it is installed`,
    });
    return steps;
  }

  console.log(chalk.dim(`  Initializing OpenSpec for: ${tools.join(', ')}...`));
  const initResult = await run(binaryPath, ['init', context.projectRoot, '--tools', tools.join(','), '--force'], {
    cwd: context.projectRoot,
    inherit: context.interactive,
  });
  if (initResult.code !== 0) {
    steps.push({
      label: 'openspec init',
      status: 'failed',
      detail: `\`openspec init --tools ${tools.join(',')}\` exited with code ${initResult.code}`,
    });
    return steps;
  }
  steps.push({ label: 'openspec init', status: 'done', detail: `tools: ${tools.join(', ')}` });
  steps.push(...await configureProfile(binaryPath));
  steps.push(await configureGuidance(context));
  return steps;
}

export const openspecInstaller: ToolInstaller = { definition, install };
