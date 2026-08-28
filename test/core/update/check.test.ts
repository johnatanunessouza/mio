import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readUpdateCache, writeUpdateCache } from '../../../src/core/update/cache.js';
import { runUpdateCheck } from '../../../src/core/update/check.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-update-check-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const cacheFile = () => path.join(root, 'update-check.json');

function stubFetch(reply: () => Promise<unknown>): typeof fetch {
  return (async () => await reply()) as unknown as typeof fetch;
}

const releaseReply = (tag: string) => async () => ({ ok: true, status: 200, json: async () => ({ tag_name: tag }) });

describe('runUpdateCheck', () => {
  it('records the release it found, for the next run to report', async () => {
    await runUpdateCheck(['owner/repo', cacheFile()], {
      fetchImpl: stubFetch(releaseReply('v1.12.0')),
      now: () => 5_000
    });
    expect(await readUpdateCache(cacheFile())).toEqual({ lastCheckedAt: 5_000, latestVersion: '1.12.0' });
  });

  it('still records the attempt when the lookup fails, so an offline machine checks once a day, not once a command', async () => {
    await writeUpdateCache(cacheFile(), { lastCheckedAt: 1_000, latestVersion: '1.12.0' });
    await runUpdateCheck(['owner/repo', cacheFile()], {
      fetchImpl: stubFetch(async () => { throw new Error('offline'); }),
      now: () => 9_000
    });
    expect(await readUpdateCache(cacheFile())).toEqual({ lastCheckedAt: 9_000, latestVersion: '1.12.0' });
  });

  it('ignores an incomplete invocation instead of writing junk', async () => {
    await runUpdateCheck([], { fetchImpl: stubFetch(releaseReply('v1.12.0')) });
    await runUpdateCheck(['owner/repo'], { fetchImpl: stubFetch(releaseReply('v1.12.0')) });
    await runUpdateCheck(['not-a-slug', cacheFile()], { fetchImpl: stubFetch(releaseReply('v1.12.0')) });
    expect(await readUpdateCache(cacheFile())).toBeUndefined();
  });
});
