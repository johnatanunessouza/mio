import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readUpdateCache, updateCachePath, writeUpdateCache } from '../../../src/core/update/cache.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-update-cache-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const cacheFile = () => path.join(root, 'nested', 'update-check.json');

describe('updateCachePath', () => {
  it('honours XDG_CACHE_HOME', () => {
    expect(updateCachePath({ XDG_CACHE_HOME: '/xdg' }, '/home/user')).toBe(path.join('/xdg', 'mio-cli', 'update-check.json'));
  });

  it('falls back to ~/.cache', () => {
    expect(updateCachePath({}, '/home/user')).toBe(path.join('/home/user', '.cache', 'mio-cli', 'update-check.json'));
  });

  it('ignores a blank override', () => {
    expect(updateCachePath({ XDG_CACHE_HOME: '  ' }, '/home/user')).toBe(path.join('/home/user', '.cache', 'mio-cli', 'update-check.json'));
  });
});

describe('the cache file', () => {
  it('round-trips a state, creating the directory', async () => {
    await writeUpdateCache(cacheFile(), { lastCheckedAt: 42, latestVersion: '1.12.0' });
    expect(await readUpdateCache(cacheFile())).toEqual({ lastCheckedAt: 42, latestVersion: '1.12.0' });
  });

  it('reads a state that never found a release', async () => {
    await writeUpdateCache(cacheFile(), { lastCheckedAt: 42 });
    expect(await readUpdateCache(cacheFile())).toEqual({ lastCheckedAt: 42, latestVersion: undefined });
  });

  it('reports no data for a missing file', async () => {
    expect(await readUpdateCache(path.join(root, 'absent.json'))).toBeUndefined();
  });

  it('reports no data for a malformed or unexpected file instead of throwing', async () => {
    const file = path.join(root, 'bad.json');
    writeFileSync(file, '{ not json', 'utf8');
    expect(await readUpdateCache(file)).toBeUndefined();
    writeFileSync(file, '"a string"', 'utf8');
    expect(await readUpdateCache(file)).toBeUndefined();
    writeFileSync(file, '{"lastCheckedAt":"yesterday"}', 'utf8');
    expect(await readUpdateCache(file)).toBeUndefined();
  });

  it('swallows a write it cannot perform', async () => {
    const file = path.join(root, 'blocked');
    writeFileSync(file, 'a file where a directory would have to be', 'utf8');
    await expect(writeUpdateCache(path.join(file, 'update-check.json'), { lastCheckedAt: 1 })).resolves.toBeUndefined();
  });
});
