import chalk from 'chalk';
import { run } from '../../utils/exec.js';
import { ensureBinary } from './binary.js';
import type { AgentDefinition } from '../agents/types.js';
import type { ToolDefinition, ToolInstallContext, ToolInstallStep, ToolInstaller } from './types.js';

const definition: ToolDefinition = {
  id: 'caveman',
  name: 'Caveman',
  description: 'Instruments agent conversations with recoverable context compression',
  binary: 'caveman',
  npmPackage: '@caveman-ai/cli',
};

/**
 * mio agent ids → Caveman agent profile ids. Identity mappings are omitted; an
 * id absent from both this table and `CAVEMAN_AGENT_IDS` has no Caveman
 * profile and is reported as unsupported rather than silently dropped.
 */
const AGENT_TO_CAVEMAN_AGENT: Readonly<Record<string, string>> = {
  'oh-my-pi': 'pi',
};

/** Agent profiles shipped by `@caveman-ai/cli` (`dist/agents.generated.js`). */
const CAVEMAN_AGENT_IDS: ReadonlySet<string> = new Set([
  'aider', 'claude', 'codex', 'gemini', 'hermes', 'openclaw', 'opencode', 'pi',
]);

/**
 * Agents Caveman can rewrite a command-output compression hook into. `aider`
 * has a profile but only manual hook instructions, so it is excluded here.
 */
const HOOKABLE_AGENT_IDS: ReadonlySet<string> = new Set([
  'claude', 'codex', 'gemini', 'hermes', 'openclaw', 'opencode', 'pi',
]);

/** Agents accepted by `caveman setup --agent-native`. */
const AGENT_NATIVE_IDS: ReadonlySet<string> = new Set(['claude', 'codex']);

export interface MappedAgents {
  /** Caveman profile ids, sorted. */
  agents: string[];
  /** Subset of `agents` that accepts `caveman hooks install`. */
  hookable: string[];
  /** Subset of `agents` that accepts `caveman setup --agent-native`. */
  agentNative: string[];
  /** mio agent ids Caveman has no profile for, sorted. */
  unsupported: string[];
}

export function mapAgentsToCavemanAgents(agents: readonly AgentDefinition[]): MappedAgents {
  const mapped = new Set<string>();
  const unsupported: string[] = [];
  for (const agent of agents) {
    const id = AGENT_TO_CAVEMAN_AGENT[agent.id] ?? agent.id;
    if (CAVEMAN_AGENT_IDS.has(id)) mapped.add(id);
    else unsupported.push(agent.id);
  }
  const sorted = [...mapped].sort();
  return {
    agents: sorted,
    hookable: sorted.filter((id) => HOOKABLE_AGENT_IDS.has(id)),
    agentNative: sorted.filter((id) => AGENT_NATIVE_IDS.has(id)),
    unsupported: unsupported.sort(),
  };
}

/**
 * Caveman's compression and metering live in companion Go binaries that the
 * npm package does not ship. `setup --install` fetches them; without them the
 * hook and MCP registrations still install but do nothing at runtime.
 */
async function installCompanionBinaries(binaryPath: string): Promise<ToolInstallStep> {
  const result = await run(binaryPath, ['setup', '--install'], { inherit: false });
  return result.code === 0
    ? { label: 'companion binaries', status: 'done', detail: '`caveman setup --install` completed' }
    : {
        label: 'companion binaries',
        status: 'failed',
        detail: `\`caveman setup --install\` exited with code ${result.code} — run it by hand to enable compression`,
      };
}

/**
 * Register the pieces that instrument a conversation, one step per agent so a
 * single unsupported or failing agent never hides the others' outcome.
 */
async function instrumentAgents(binaryPath: string, mapped: MappedAgents): Promise<ToolInstallStep[]> {
  const steps: ToolInstallStep[] = [];

  for (const agent of mapped.hookable) {
    const result = await run(binaryPath, ['hooks', 'install', agent], { inherit: false });
    steps.push(result.code === 0
      ? { label: `output hook → ${agent}`, status: 'done', detail: 'shell output is compressed before the model reads it' }
      : { label: `output hook → ${agent}`, status: 'failed', detail: `\`caveman hooks install ${agent}\` exited with code ${result.code}` });
  }

  for (const agent of mapped.agents) {
    const result = await run(binaryPath, ['mcp', 'install', agent], { inherit: false });
    steps.push(result.code === 0
      ? { label: `recovery MCP → ${agent}`, status: 'done', detail: 'caveman_retrieve registered' }
      : { label: `recovery MCP → ${agent}`, status: 'failed', detail: `\`caveman mcp install ${agent}\` exited with code ${result.code}` });
  }

  for (const agent of mapped.agentNative) {
    const result = await run(binaryPath, ['setup', '--agent-native', agent], { inherit: false });
    steps.push(result.code === 0
      ? { label: `agent-native → ${agent}`, status: 'done', detail: 'compression runs without wrapping the agent command' }
      : { label: `agent-native → ${agent}`, status: 'failed', detail: `\`caveman setup --agent-native ${agent}\` exited with code ${result.code}` });
  }

  return steps;
}

async function install(context: ToolInstallContext): Promise<ToolInstallStep[]> {
  const steps: ToolInstallStep[] = [];
  const { binaryPath, step } = await ensureBinary(definition, context.dryRun);
  steps.push(step);

  const mapped = mapAgentsToCavemanAgents(context.agents);
  if (mapped.unsupported.length > 0) {
    steps.push({
      label: 'unsupported agents',
      status: 'skipped',
      detail: `Caveman has no profile for: ${mapped.unsupported.join(', ')}`,
    });
  }

  if (mapped.agents.length === 0) {
    steps.push({ label: 'instrument agents', status: 'skipped', detail: 'none of the selected agents map to a Caveman profile' });
    return steps;
  }

  if (context.dryRun) {
    steps.push({ label: 'companion binaries', status: 'skipped', detail: 'dry run: would run `caveman setup --install`' });
    steps.push({ label: 'instrument agents', status: 'skipped', detail: `dry run: would instrument ${mapped.agents.join(', ')}` });
    return steps;
  }

  if (!binaryPath) {
    steps.push({
      label: 'instrument agents',
      status: 'skipped',
      detail: `caveman unavailable — run \`caveman setup --install\` and \`caveman hooks install\` once it is installed`,
    });
    return steps;
  }

  console.log(chalk.dim(`  Instrumenting agent conversations with caveman: ${mapped.agents.join(', ')}...`));
  steps.push(await installCompanionBinaries(binaryPath));
  steps.push(...await instrumentAgents(binaryPath, mapped));
  return steps;
}

export const cavemanInstaller: ToolInstaller = { definition, install };
