import { createHash } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { run } from '../../utils/exec.js';
import type { SkillRepositoryCheckout, SkillRepositoryDefinition } from './types.js';

/** Where remote repositories are cloned, outside any project. */
export function skillRepoCacheRoot(home: string = homedir()): string {
  return path.join(home, '.mio', 'skill-repos');
}

/**
 * A source is local when it names something on disk. Path-shaped strings are
 * treated as local even when missing, so a typo reports the path instead of
 * being handed to `git clone` as if it were a remote.
 */
export function isLocalSource(source: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) return false;
  if (/^[^/]+@[^/]+:/.test(source)) return false; // scp-style: git@host:org/repo.git
  return true;
}

export function resolveLocalSource(source: string, cwd: string = process.cwd()): string {
  const expanded = source.startsWith('~/') ? path.join(homedir(), source.slice(2)) : source;
  return path.resolve(cwd, expanded);
}

/** Stable per-source cache directory: readable slug plus a hash for uniqueness. */
export function cacheDirectoryFor(repository: SkillRepositoryDefinition, home?: string): string {
  const slug = (repository.source.replace(/\.git$/, '').split(/[/:]/).filter(Boolean).slice(-2).join('-') || repository.id)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const digest = createHash('sha256').update(`${repository.source}#${repository.ref ?? ''}`).digest('hex').slice(0, 8);
  return path.join(skillRepoCacheRoot(home), `${slug || 'repo'}-${digest}`);
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function cloneOrUpdate(repository: SkillRepositoryDefinition, destination: string, offline: boolean): Promise<void> {
  if (await isDirectory(path.join(destination, '.git'))) {
    // An existing clone is refreshed in place so a stale cache never silently
    // hides skills that were added upstream.
    if (offline) return;
    const fetch = await run('git', ['fetch', '--depth', '1', 'origin', repository.ref ?? 'HEAD'], { cwd: destination });
    if (fetch.code !== 0) throw new Error(`Failed to refresh ${repository.source}: ${fetch.stderr.trim()}`);
    const reset = await run('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: destination });
    if (reset.code !== 0) throw new Error(`Failed to refresh ${repository.source}: ${reset.stderr.trim()}`);
    return;
  }

  if (offline) throw new Error(`No cached checkout of ${repository.source}; re-run without --offline`);
  await mkdir(path.dirname(destination), { recursive: true });
  const args = ['clone', '--depth', '1'];
  if (repository.ref) args.push('--branch', repository.ref);
  args.push(repository.source, destination);
  const clone = await run('git', args);
  if (clone.code === 127) throw new Error('git is required to fetch a remote skills repository, but it is not on PATH');
  if (clone.code !== 0) throw new Error(`Failed to clone ${repository.source}: ${clone.stderr.trim()}`);
}

export interface CheckoutOptions {
  /** Reuse the cached clone without contacting the remote. */
  offline?: boolean;
  /** Base for relative local sources. Defaults to the process working directory. */
  cwd?: string;
  /** Home directory holding the clone cache. Defaults to the user home. */
  home?: string;
}

/**
 * Resolve a repository to a directory on disk. Local sources are read in
 * place — mio never writes to a checkout the user manages — while remote ones
 * are cloned shallowly into the cache and refreshed on each run.
 */
export async function checkoutSkillRepository(
  repository: SkillRepositoryDefinition,
  options: CheckoutOptions = {}
): Promise<SkillRepositoryCheckout> {
  let root: string;
  let origin: SkillRepositoryCheckout['origin'];

  if (isLocalSource(repository.source)) {
    root = resolveLocalSource(repository.source, options.cwd);
    origin = 'local';
    if (!(await isDirectory(root))) throw new Error(`Skills repository not found: ${root}`);
  } else {
    root = cacheDirectoryFor(repository, options.home);
    origin = 'clone';
    await cloneOrUpdate(repository, root, options.offline === true);
  }

  const skillsRoot = path.resolve(root, repository.skillsDir);
  if (!(await isDirectory(skillsRoot))) {
    throw new Error(`Repository ${repository.source} has no "${repository.skillsDir}" directory (looked in ${skillsRoot})`);
  }
  return { repository, root, skillsRoot, origin };
}
