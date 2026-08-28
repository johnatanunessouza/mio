import type { AgentDefinition } from '../agents/types.js';
import { copyTree, resolveSkillPath } from '../skills/install.js';
import type { InstalledRepositorySkill, RepositorySkill } from './types.js';

export interface InstallRepositorySkillsOptions {
  projectRoot: string;
  agents: readonly AgentDefinition[];
  skills: readonly RepositorySkill[];
}

/**
 * Copy the selected repository skills into every agent that supports local
 * skills. Agents sharing a directory (`.agents`) resolve to the same path, so
 * each bundle is written once and reported once — the rule the bundled skill
 * installer already follows.
 */
export async function installRepositorySkills(
  options: InstallRepositorySkillsOptions
): Promise<InstalledRepositorySkill[]> {
  const installed: InstalledRepositorySkill[] = [];
  for (const skill of options.skills) {
    const seen = new Set<string>();
    for (const agent of options.agents) {
      const destination = resolveSkillPath(agent, options.projectRoot, skill.id);
      if (!destination || seen.has(destination)) continue;
      seen.add(destination);
      installed.push({ skill, agent, path: destination, changed: await copyTree(skill.path, destination) });
    }
  }
  return installed;
}
