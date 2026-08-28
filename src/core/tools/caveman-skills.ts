import chalk from 'chalk';
import { run, which } from '../../utils/exec.js';
import type { AgentDefinition } from '../agents/types.js';
import type { ToolDefinition, ToolInstallContext, ToolInstallStep, ToolInstaller } from './types.js';

/** Repository the Caveman skill suite is published from. */
export const CAVEMAN_SKILLS_SOURCE = 'JuliusBrussee/caveman';

const definition: ToolDefinition = {
  id: 'caveman-skills',
  name: 'Caveman Skills',
  description: 'Token-efficient workflow skills (compress, explore, review) for your agents',
  binary: 'skills',
  npmPackage: 'skills',
};

/**
 * mio agent ids → `skills add --agent` ids. Identity mappings are omitted; an
 * id absent from both this table and `SKILLS_AGENT_IDS` has no target in the
 * Skills CLI and is reported as unsupported rather than silently dropped.
 *
 * `oh-my-pi` is deliberately absent: it keeps skills in `.omp`, while the
 * Skills CLI's `pi` target writes to `.pi/skills`.
 */
const AGENT_TO_SKILLS_AGENT: Readonly<Record<string, string>> = {
  agents: 'universal',
  auggie: 'augment',
  claude: 'claude-code',
  codeartsagent: 'codearts-agent',
  factory: 'droid',
  gemini: 'gemini-cli',
  hermes: 'hermes-agent',
  iflow: 'iflow-cli',
  kilocode: 'kilo',
  kimi: 'kimi-code-cli',
  kiro: 'kiro-cli',
  qwen: 'qwen-code',
  roocode: 'roo',
  vibe: 'mistral-vibe',
};

/** Agent ids accepted by `skills add --agent` that mio also offers. */
const SKILLS_AGENT_IDS: ReadonlySet<string> = new Set([
  'antigravity', 'augment', 'bob', 'claude-code', 'cline', 'codearts-agent', 'codebuddy', 'codex',
  'command-code', 'continue', 'crush', 'cursor', 'devin', 'droid', 'forgecode', 'gemini-cli',
  'github-copilot', 'hermes-agent', 'iflow-cli', 'junie', 'kilo', 'kimi-code-cli', 'kiro-cli',
  'lingma', 'minimax-code', 'mistral-vibe', 'opencode', 'pi', 'qoder', 'qwen-code', 'roo',
  'rovodev', 'trae', 'universal', 'zcode', 'zed',
]);

export interface MappedSkillsAgents {
  /** Skills CLI agent ids, sorted. */
  agents: string[];
  /** mio agent ids the Skills CLI has no target for, sorted. */
  unsupported: string[];
}

export function mapAgentsToSkillsAgents(agents: readonly AgentDefinition[]): MappedSkillsAgents {
  const mapped = new Set<string>();
  const unsupported: string[] = [];
  for (const agent of agents) {
    const id = AGENT_TO_SKILLS_AGENT[agent.id] ?? agent.id;
    if (SKILLS_AGENT_IDS.has(id)) mapped.add(id);
    else unsupported.push(agent.id);
  }
  return { agents: [...mapped].sort(), unsupported: unsupported.sort() };
}

/**
 * Arguments for a non-interactive project-level install of every skill in the
 * suite. `--yes` skips the confirmation prompt and `--copy` writes real files
 * instead of symlinks into a checkout mio does not own.
 */
export function buildAddArgs(agents: readonly string[]): string[] {
  return ['add', CAVEMAN_SKILLS_SOURCE, '--skill', '*', '--agent', agents.join(','), '--yes', '--copy'];
}

/**
 * The Skills CLI is normally used through `npx`, so mio prefers an installed
 * `skills` binary and falls back to `npx -y skills@latest` rather than
 * installing the package globally.
 */
async function resolveSkillsCommand(): Promise<{ command: string; prefix: string[]; label: string }> {
  const installed = await which(definition.binary);
  if (installed) return { command: installed, prefix: [], label: installed };
  return { command: 'npx', prefix: ['-y', 'skills@latest'], label: 'npx -y skills@latest' };
}

async function install(context: ToolInstallContext): Promise<ToolInstallStep[]> {
  const steps: ToolInstallStep[] = [];

  const { agents, unsupported } = mapAgentsToSkillsAgents(context.agents);
  if (unsupported.length > 0) {
    steps.push({
      label: 'unsupported agents',
      status: 'skipped',
      detail: `the Skills CLI has no target for: ${unsupported.join(', ')}`,
    });
  }

  if (agents.length === 0) {
    steps.push({ label: 'install skills', status: 'skipped', detail: 'none of the selected agents map to a Skills CLI target' });
    return steps;
  }

  const { command, prefix, label } = await resolveSkillsCommand();
  const args = [...prefix, ...buildAddArgs(agents)];
  steps.push({ label: 'skills CLI', status: 'done', detail: label });

  if (context.dryRun) {
    steps.push({
      label: 'install skills',
      status: 'skipped',
      detail: `dry run: would run \`${label} ${buildAddArgs(agents).join(' ')}\``,
    });
    return steps;
  }

  console.log(chalk.dim(`  Installing the Caveman skill suite for: ${agents.join(', ')}...`));
  const result = await run(command, args, { cwd: context.projectRoot, inherit: context.interactive });
  steps.push(result.code === 0
    ? { label: 'install skills', status: 'done', detail: `${CAVEMAN_SKILLS_SOURCE} → ${agents.join(', ')}` }
    : {
        label: 'install skills',
        status: 'failed',
        detail: `\`${label} add ${CAVEMAN_SKILLS_SOURCE}\` exited with code ${result.code}${result.stderr.trim() ? `: ${result.stderr.trim().split('\n').at(-1)}` : ''}`,
      });
  return steps;
}

export const cavemanSkillsInstaller: ToolInstaller = { definition, install };
