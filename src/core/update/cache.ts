import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export interface UpdateCacheState {
  /** Epoch ms of the last completed check, successful or not. */
  lastCheckedAt: number;
  /** Latest version the check saw, without the `v` prefix. */
  latestVersion?: string;
}

/**
 * Where the check result lives between runs — XDG cache, not the project.
 * It is a cache in the strict sense: deleting it only costs one extra check.
 */
export function updateCachePath(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const base = env.XDG_CACHE_HOME?.trim() || path.join(home, '.cache');
  return path.join(base, 'mio-cli', 'update-check.json');
}

/** Read the cache, treating every failure — missing, malformed, unreadable — as "no data". */
export async function readUpdateCache(file: string): Promise<UpdateCacheState | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { lastCheckedAt, latestVersion } = parsed as Record<string, unknown>;
    if (typeof lastCheckedAt !== 'number' || !Number.isFinite(lastCheckedAt)) return undefined;
    return {
      lastCheckedAt,
      latestVersion: typeof latestVersion === 'string' ? latestVersion : undefined
    };
  } catch {
    return undefined;
  }
}

/** Persist the check result. Never throws: a cache that cannot be written is not an error the user should see. */
export async function writeUpdateCache(file: string, state: UpdateCacheState): Promise<void> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch {
    // Ignored on purpose.
  }
}
