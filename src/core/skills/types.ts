import type { AgentDefinition } from '../agents/types.js';

export interface SkillCommandDefinition {
  /** Command name inside the mio namespace, e.g. `agents-create` → `/mio:agents-create`. */
  name: string;
  /** Title rendered in the command frontmatter for agents that show one. */
  title: string;
  description: string;
  /** Asset file under `assets/commands/` holding the prompt body. */
  body: string;
}

export interface SkillDefinition {
  /** Bundle directory under `assets/skills/`, also the installed skill name. */
  id: string;
  name: string;
  description: string;
  /** Installed by `mio init` unless the selection says otherwise. */
  isDefault: boolean;
  /** Slash commands installed alongside the skill bundle. */
  commands: readonly SkillCommandDefinition[];
}

export interface InstalledSkill {
  agent: AgentDefinition;
  path: string;
  changed: boolean;
}

export interface InstalledCommand {
  agent: AgentDefinition;
  command: SkillCommandDefinition;
  path: string;
  /** How the command is typed in that agent, e.g. `/mio:agents-create`. */
  invocation: string;
  changed: boolean;
}

export interface SkillInstallResult {
  skill: SkillDefinition;
  skills: InstalledSkill[];
  commands: InstalledCommand[];
}
