import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mergeManagedBlock } from '../instructions/block.js';
import { filterInstalledSkills } from '../skills/installed.js';
import { OPENSPEC_GUIDANCE_BLOCK_ID, guidanceForSkills, guidanceSkillIds, renderGuidance } from './guidance.js';

/** Directory `openspec init` creates at the project root. */
export const OPENSPEC_DIR = 'openspec';

/** Config spellings OpenSpec accepts, `.yaml` first — the one it writes. */
const CONFIG_FILENAMES = ['config.yaml', 'config.yml'] as const;

/**
 * The project's OpenSpec config file, or `undefined` when the project has no
 * `openspec/` directory. A project that has the directory but no config yet
 * resolves to `config.yaml`, the file `openspec init` would have written.
 */
export async function findOpenspecConfigPath(projectRoot: string): Promise<string | undefined> {
  const openspecDir = path.join(projectRoot, OPENSPEC_DIR);
  for (const name of CONFIG_FILENAMES) {
    try {
      const candidate = path.join(openspecDir, name);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
  }
  try {
    if (!(await stat(openspecDir)).isDirectory()) return undefined;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  return path.join(openspecDir, CONFIG_FILENAMES[0]);
}

export interface ApplyOpenspecGuidanceOptions {
  projectRoot: string;
  /**
   * Skills to treat as present regardless of what is on disk — the ids a
   * command just installed. Anything else is detected by scanning the agents'
   * skill directories.
   */
  skillIds?: readonly string[];
  /** Report what would be written without touching the file. */
  dryRun?: boolean;
}

export interface OpenspecGuidanceResult {
  /** Config file the block was written to; absent when nothing was written. */
  path?: string;
  changed: boolean;
  /** Skills whose guidance the block now carries, in catalog order. */
  skillIds: string[];
  /** Sections the block defines, e.g. `archive`. */
  sections: string[];
  /** Why nothing was written, when `path` is absent. */
  reason?: 'no-openspec-project' | 'no-guidance';
}

/**
 * Write the guidance contributed by the project's skills into
 * `openspec/config.yaml`, inside a marker block mio owns.
 *
 * The block is regenerated from the catalog every run, so the file converges
 * on the same content whether the skill or the OpenSpec project came first —
 * `mio init` applies it when it generates OpenSpec, and `mio skills-list`
 * applies it when a contributing skill is installed into an existing project.
 * Everything outside the markers, including anything the user wrote, is
 * preserved byte-for-byte.
 */
export async function applyOpenspecGuidance(
  options: ApplyOpenspecGuidanceOptions
): Promise<OpenspecGuidanceResult> {
  const supplied = new Set((options.skillIds ?? []).map((id) => id.trim().toLowerCase()));
  const detected = await filterInstalledSkills(
    options.projectRoot,
    guidanceSkillIds().filter((id) => !supplied.has(id))
  );
  const entries = guidanceForSkills([...supplied, ...detected]);
  const skillIds = [...new Set(entries.map((entry) => entry.skillId))];
  const sections = [...new Set(entries.map((entry) => entry.section))];
  if (entries.length === 0) return { changed: false, skillIds, sections, reason: 'no-guidance' };

  const configPath = await findOpenspecConfigPath(options.projectRoot);
  if (!configPath) return { changed: false, skillIds, sections, reason: 'no-openspec-project' };
  if (options.dryRun) return { path: configPath, changed: false, skillIds, sections };

  let original = '';
  try {
    original = await readFile(configPath, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const next = mergeManagedBlock(original, OPENSPEC_GUIDANCE_BLOCK_ID, renderGuidance(entries), 'yaml');
  if (next === original) return { path: configPath, changed: false, skillIds, sections };
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, next, 'utf8');
  return { path: configPath, changed: true, skillIds, sections };
}
