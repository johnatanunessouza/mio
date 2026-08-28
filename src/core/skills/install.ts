import { chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentDefinition } from '../agents/types.js';
import { confinedPath, skillAssetDir } from './assets.js';
import { installCommandsForAgents } from './commands.js';
import { resolveSkills } from './registry.js';
import type { InstalledSkill, SkillDefinition, SkillInstallResult } from './types.js';

export { skillAssetDir } from './assets.js';
export type { InstalledSkill } from './types.js';

/** Destination of a skill bundle for one agent, e.g. `<root>/.claude/skills/codegraph`. */
export function resolveSkillPath(agent: AgentDefinition, projectRoot: string, skillName: string): string | undefined {
  if (!agent.skillsDir) return undefined;
  return confinedPath(projectRoot, path.join(agent.skillsDir, 'skills', skillName));
}

/**
 * Copy a bundle tree, returning whether anything changed. Shared with the
 * repository installer so both paths keep the same idempotence and mode rules.
 */
export async function copyTree(source: string, destination: string): Promise<boolean> {
  let changed = false;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      changed = (await copyTree(from, to)) || changed;
      continue;
    }
    const content = await readFile(from, 'utf8');
    const mode = (await stat(from)).mode & 0o777;
    let existing: string | undefined;
    let existingMode: number | undefined;
    try {
      existing = await readFile(to, 'utf8');
      existingMode = (await stat(to)).mode & 0o777;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    // Bundled shell scripts are installed executable whatever mode the source
    // carries: `npm pack` drops the bit, so a published mio would otherwise
    // ship a script the agent cannot run directly. An existing copy with the
    // right content but the wrong mode is repaired too.
    const executable = (mode & 0o111) !== 0 || to.endsWith('.sh');
    const modeMatches = existingMode === undefined || ((existingMode & 0o111) !== 0) === executable;
    if (existing === content && modeMatches) continue;

    if (existing !== content) {
      await mkdir(path.dirname(to), { recursive: true });
      await writeFile(to, content, 'utf8');
    }
    if (executable) await chmod(to, (mode & 0o111) !== 0 ? mode : 0o755);
    changed = true;
  }
  return changed;
}

/**
 * Copy a bundled skill into every selected agent that supports local skills.
 * Agents sharing a skills directory (`.agents`) resolve to the same path, so
 * the bundle is written once and reported once.
 */
export async function installSkillForAgents(
  skillName: string,
  agents: readonly AgentDefinition[],
  projectRoot: string
): Promise<InstalledSkill[]> {
  const source = skillAssetDir(skillName);
  const seen = new Set<string>();
  const installed: InstalledSkill[] = [];
  for (const agent of agents) {
    const destination = resolveSkillPath(agent, projectRoot, skillName);
    if (!destination || seen.has(destination)) continue;
    seen.add(destination);
    installed.push({ agent, path: destination, changed: await copyTree(source, destination) });
  }
  return installed;
}

/** Install one catalog skill: its bundle plus the commands that invoke it. */
export async function installSkill(
  skill: SkillDefinition,
  agents: readonly AgentDefinition[],
  projectRoot: string
): Promise<SkillInstallResult> {
  return {
    skill,
    skills: await installSkillForAgents(skill.id, agents, projectRoot),
    commands: await installCommandsForAgents(skill.commands, agents, projectRoot),
  };
}

export interface InstallSkillsOptions {
  projectRoot: string;
  agents: readonly AgentDefinition[];
  /** Catalog skill ids; validated as a set before anything is written. */
  skillIds: readonly string[];
}

/**
 * Install every requested skill in catalog order. Ids are resolved up front so
 * a typo fails before the first file is written, matching how `mio init`
 * validates agent selections.
 */
export async function installSkills(options: InstallSkillsOptions): Promise<SkillInstallResult[]> {
  const results: SkillInstallResult[] = [];
  for (const skill of resolveSkills(options.skillIds)) {
    results.push(await installSkill(skill, options.agents, options.projectRoot));
  }
  return results;
}
