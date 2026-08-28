import type { AgentDefinition } from '../agents/types.js';

export interface SkillRepositoryDefinition {
  id: string;
  name: string;
  /** Git remote URL, or a local path when the repository is checked out already. */
  source: string;
  /** Directory inside the repository holding the category folders. */
  skillsDir: string;
  /** Branch or tag to check out; the remote default branch when absent. */
  ref?: string;
}

/** A repository resolved to a directory on disk, ready to be read. */
export interface SkillRepositoryCheckout {
  repository: SkillRepositoryDefinition;
  /** Absolute path of the checkout: the cache clone, or the local source. */
  root: string;
  /** Absolute path of `<root>/<skillsDir>`. */
  skillsRoot: string;
  /** A local source is used in place; a remote one is cloned and refreshed. */
  origin: 'local' | 'clone';
}

export interface RepositorySkill {
  /** Directory name, and the name the skill is installed under. */
  id: string;
  category: string;
  /** Absolute path of the skill bundle inside the checkout. */
  path: string;
  /** `name:` from the SKILL.md frontmatter; falls back to the directory name. */
  name: string;
  /** `description:` from the SKILL.md frontmatter, when it declares one. */
  description?: string;
}

export interface SkillCategory {
  /** Directory name under the repository skills directory. */
  id: string;
  path: string;
  skills: RepositorySkill[];
}

export interface InstalledRepositorySkill {
  skill: RepositorySkill;
  agent: AgentDefinition;
  path: string;
  changed: boolean;
}
