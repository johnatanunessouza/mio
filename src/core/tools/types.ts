import type { AgentDefinition } from '../agents/types.js';

export type ToolId = 'codegraph' | 'openspec' | 'caveman' | 'caveman-skills';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  /** Executable that must be on PATH for the tool to be usable. */
  binary: string;
  /** npm package installed globally when the binary is missing. */
  npmPackage: string;
}

export interface ToolInstallContext {
  projectRoot: string;
  /** Agents the user selected during `mio init`. */
  agents: readonly AgentDefinition[];
  /** Whether the terminal can host prompts and inherited child output. */
  interactive: boolean;
  /** Skip every child-process invocation; only file fixtures are written. */
  dryRun?: boolean;
}

export type StepStatus = 'done' | 'skipped' | 'failed';

export interface ToolInstallStep {
  label: string;
  status: StepStatus;
  /** Extra context: a path written, a command to run by hand, a failure cause. */
  detail?: string;
}

export interface ToolInstallResult {
  tool: ToolDefinition;
  steps: ToolInstallStep[];
}

export interface ToolInstaller {
  definition: ToolDefinition;
  install(context: ToolInstallContext): Promise<ToolInstallStep[]>;
}
