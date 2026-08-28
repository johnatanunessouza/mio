import { stat } from 'node:fs/promises';
import path from 'node:path';
import { listAgents } from '../agents/registry.js';
import { confinedPath } from './assets.js';

/**
 * Every place a skill bundle could sit for one agent: the directory mio writes
 * to, plus the legacy directories an older layout may still be using. Detection
 * only reads, so covering the legacy paths costs nothing and stops a project
 * that predates a rename from looking empty.
 */
function candidatePaths(projectRoot: string, skillId: string): string[] {
  const candidates: string[] = [];
  for (const agent of listAgents()) {
    for (const dir of [agent.skillsDir, ...(agent.legacySkillsDirs ?? [])]) {
      if (!dir) continue;
      candidates.push(confinedPath(projectRoot, path.join(dir, 'skills', skillId)));
    }
  }
  return [...new Set(candidates)];
}

/**
 * Whether a skill bundle is present in any agent's local skills directory.
 *
 * The whole agent catalog is scanned rather than the agents selected for the
 * current run: a skill installed for one agent is still installed in the
 * project when a later command configures another.
 */
export async function isSkillInstalled(projectRoot: string, skillId: string): Promise<boolean> {
  for (const target of candidatePaths(projectRoot, skillId)) {
    try {
      if ((await stat(target)).isDirectory()) return true;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
  }
  return false;
}

/** The subset of `skillIds` installed in the project, in the order given. */
export async function filterInstalledSkills(
  projectRoot: string,
  skillIds: readonly string[]
): Promise<string[]> {
  const installed: string[] = [];
  for (const skillId of skillIds) {
    if (await isSkillInstalled(projectRoot, skillId)) installed.push(skillId);
  }
  return installed;
}
