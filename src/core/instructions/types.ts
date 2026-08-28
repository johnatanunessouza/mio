import type { AgentDefinition } from '../agents/types.js';

export interface InstructionDefinition {
  /** Stable id, also the asset filename under `assets/instructions/`. */
  id: string;
  name: string;
  description: string;
  /** Installed by `mio init` unless the selection says otherwise. */
  isDefault: boolean;
}

export interface InstalledInstruction {
  agent: AgentDefinition;
  instruction: InstructionDefinition;
  path: string;
  changed: boolean;
  /** True when the block was merged into a file that already existed. */
  merged: boolean;
}
