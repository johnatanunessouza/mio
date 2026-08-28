import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readUpdateCache, writeUpdateCache } from './cache.js';
import { fetchLatestRelease } from './release.js';

export interface RunUpdateCheckOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * The detached worker. It refreshes the cache for the *next* run and prints
 * nothing — whatever it learns is reported by the following invocation.
 *
 * `lastCheckedAt` is written even when the lookup fails, so an offline machine
 * spawns one process a day instead of one per command.
 */
export async function runUpdateCheck(argv: string[], options: RunUpdateCheckOptions = {}): Promise<void> {
  const [slugArgument, cacheFile] = argv;
  const [owner, repo] = (slugArgument ?? '').split('/');
  if (!owner || !repo || !cacheFile) return;

  const latestVersion = await fetchLatestRelease({ owner, repo }, { fetchImpl: options.fetchImpl });
  const previous = await readUpdateCache(cacheFile);
  await writeUpdateCache(cacheFile, {
    lastCheckedAt: (options.now ?? Date.now)(),
    latestVersion: latestVersion ?? previous?.latestVersion
  });
}

const entryPoint = process.argv[1];
if (entryPoint && path.resolve(entryPoint) === fileURLToPath(import.meta.url)) {
  void runUpdateCheck(process.argv.slice(2));
}
