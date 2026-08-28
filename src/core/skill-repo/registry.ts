import type { SkillRepositoryDefinition } from './types.js';

/**
 * The repository `mio skills-list` reads when nothing else is asked for. HTTPS
 * rather than SSH so a read-only clone needs no key; override it per run with
 * `--repo` or `MIO_SKILLS_REPO`.
 */
export const DEFAULT_SKILLS_REPO_SOURCE = 'https://github.com/johnatanunessouza/mio-brain.git';

/** Directory the categories live under, inside the repository. */
export const DEFAULT_SKILLS_DIR = 'skills';

/** Repositories mio knows about, in menu order. */
export const SKILL_REPOSITORY_CATALOG: readonly SkillRepositoryDefinition[] = [
  {
    id: 'mio-brain',
    name: 'mio brain',
    source: DEFAULT_SKILLS_REPO_SOURCE,
    skillsDir: DEFAULT_SKILLS_DIR,
  },
];

export function listSkillRepositories(): SkillRepositoryDefinition[] {
  return [...SKILL_REPOSITORY_CATALOG];
}

export function defaultSkillRepository(): SkillRepositoryDefinition {
  return SKILL_REPOSITORY_CATALOG[0];
}

export interface ResolveRepositoryOptions {
  /** `--repo`: a catalog id, a git URL, or a local path. */
  supplied?: string;
  /** `MIO_SKILLS_REPO`, consulted when nothing was supplied. */
  env?: NodeJS.ProcessEnv;
  /** `--skills-dir`, overriding the directory the categories live under. */
  skillsDir?: string;
}

/**
 * Resolve which repository to read. An explicit `--repo` wins, then
 * `MIO_SKILLS_REPO`, then the preconfigured catalog entry. A value matching a
 * catalog id selects that entry; anything else is taken as a source, so a URL
 * or a path works without registering it first.
 */
export function resolveSkillRepository(options: ResolveRepositoryOptions = {}): SkillRepositoryDefinition {
  const fallback = defaultSkillRepository();
  const requested = options.supplied?.trim() || (options.env ?? process.env).MIO_SKILLS_REPO?.trim();
  const skillsDir = options.skillsDir?.trim();

  const base = requested
    ? SKILL_REPOSITORY_CATALOG.find((repository) => repository.id === requested.toLowerCase())
      ?? { id: 'custom', name: requested, source: requested, skillsDir: fallback.skillsDir }
    : fallback;

  return skillsDir ? { ...base, skillsDir } : base;
}
