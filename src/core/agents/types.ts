/**
 * How an agent locates a namespaced slash command on disk.
 *
 * - `namespace-dir`: `<commandsDir>/<namespace>/<name>.md`, invoked as
 *   `/<namespace>:<name>` (Claude Code and the agents that copied it).
 * - `prefixed-file`: `<commandsDir>/<namespace>-<name>.md`, for agents whose
 *   command directory is flat, invoked as `/<namespace>-<name>`.
 */
export type CommandStyle = 'namespace-dir' | 'prefixed-file';

export interface AgentDefinition {
  id: string;
  name: string;
  available: true;
  skillsDir?: string;
  legacySkillsDirs?: string[];
  globalSkillsDir?: string;
  detectionPaths?: string[];
  setupNote?: string;
  requiresIdeRestart?: boolean;
  /** Command directory, relative to the project root. Defaults to `<skillsDir>/commands`. */
  commandsDir?: string;
  /** Defaults to `namespace-dir`. */
  commandStyle?: CommandStyle;
  /** File suffix for command files. Defaults to `.md`. */
  commandExtension?: string;
  /**
   * File the agent loads at the start of every session, relative to the
   * project root. Defaults to `AGENTS.md`, the format most agents read; only
   * agents known to read something else declare their own.
   */
  instructionsFile?: string;
  /** Same document in the user home, for `--global`. Absent means unsupported. */
  globalInstructionsFile?: string;
}

export interface ConfigureAgentsOptions {
  projectRoot: string;
  agentIds: string[];
  global?: boolean;
  globalHome?: string;
}

export interface GeneratedAgentConfiguration {
  agent: AgentDefinition;
  path: string;
  changed: boolean;
}
