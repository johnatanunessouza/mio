import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeUpdateCache } from '../../../src/core/update/cache.js';
import {
  UPDATE_CHECK_INTERVAL_MS,
  isUpdateCheckDisabled,
  notifyAboutUpdate,
  renderUpdateNotice,
  shouldCheck,
  updateCommand
} from '../../../src/core/update/notifier.js';
import type { RepositorySlug } from '../../../src/core/update/release.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-notifier-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const SLUG: RepositorySlug = { owner: 'johnatanunessouza', repo: 'mio' };
const NOW = UPDATE_CHECK_INTERVAL_MS * 10;
/** A check old enough that another one is due. */
const STALE = NOW - UPDATE_CHECK_INTERVAL_MS;
/** A check from a minute ago. */
const FRESH = NOW - 60_000;
const REPOSITORY_URL = 'git+https://github.com/johnatanunessouza/mio.git';

/** Capture what the notifier prints and which checks it schedules. */
function harness(overrides: Partial<Parameters<typeof notifyAboutUpdate>[0]> = {}) {
  const printed: string[] = [];
  const scheduled: Array<{ slug: RepositorySlug; cacheFile: string }> = [];
  const cacheFile = path.join(root, 'update-check.json');
  return {
    printed,
    scheduled,
    cacheFile,
    run: () =>
      notifyAboutUpdate({
        currentVersion: '1.11.0',
        packageName: 'mio-cli',
        repositoryUrl: REPOSITORY_URL,
        env: {},
        now: NOW,
        isTty: true,
        cacheFile,
        write: (message) => printed.push(message),
        scheduleCheck: (slug, file) => scheduled.push({ slug, cacheFile: file }),
        ...overrides
      })
  };
}

describe('isUpdateCheckDisabled', () => {
  it('honours the opt-outs the ecosystem already uses', () => {
    expect(isUpdateCheckDisabled({ MIO_NO_UPDATE_NOTIFIER: '1' })).toBe(true);
    expect(isUpdateCheckDisabled({ NO_UPDATE_NOTIFIER: '1' })).toBe(true);
    expect(isUpdateCheckDisabled({ CI: 'true' })).toBe(true);
    expect(isUpdateCheckDisabled({ NODE_ENV: 'test' })).toBe(true);
    expect(isUpdateCheckDisabled({})).toBe(false);
  });
});

describe('shouldCheck', () => {
  it('checks when nothing was ever checked', () => {
    expect(shouldCheck(undefined, 1_000)).toBe(true);
  });

  it('waits out the interval', () => {
    const now = UPDATE_CHECK_INTERVAL_MS * 3;
    expect(shouldCheck({ lastCheckedAt: now - 1 }, now)).toBe(false);
    expect(shouldCheck({ lastCheckedAt: now - UPDATE_CHECK_INTERVAL_MS }, now)).toBe(true);
  });

  it('checks again when the stored timestamp is in the future, because the clock moved', () => {
    expect(shouldCheck({ lastCheckedAt: 5_000 }, 1_000)).toBe(true);
  });
});

describe('updateCommand', () => {
  it('pins the release asset it is announcing', () => {
    expect(updateCommand(SLUG, 'mio-cli', '1.12.0')).toBe(
      'npm install -g https://github.com/johnatanunessouza/mio/releases/download/v1.12.0/mio-cli-1.12.0.tgz'
    );
  });
});

describe('renderUpdateNotice', () => {
  it('shows both versions and the command', () => {
    const notice = renderUpdateNotice({ current: '1.11.0', latest: '1.12.0', command: 'npm install -g x' });
    expect(notice).toContain('1.11.0');
    expect(notice).toContain('1.12.0');
    expect(notice).toContain('npm install -g x');
  });
});

describe('notifyAboutUpdate', () => {
  it('reports what the last check found, and schedules the next one', async () => {
    const h = harness();
    await writeUpdateCache(h.cacheFile, { lastCheckedAt: STALE, latestVersion: '1.12.0' });
    await h.run();
    expect(h.printed).toHaveLength(1);
    expect(h.printed[0]).toContain('1.12.0');
    expect(h.printed[0]).toContain('releases/download/v1.12.0/mio-cli-1.12.0.tgz');
    expect(h.scheduled).toEqual([{ slug: SLUG, cacheFile: h.cacheFile }]);
  });

  it('says nothing on the very first run, and only seeds the check', async () => {
    const h = harness();
    await h.run();
    expect(h.printed).toEqual([]);
    expect(h.scheduled).toHaveLength(1);
  });

  it('says nothing when the release is the version already installed', async () => {
    const h = harness();
    await writeUpdateCache(h.cacheFile, { lastCheckedAt: FRESH, latestVersion: '1.11.0' });
    await h.run();
    expect(h.printed).toEqual([]);
  });

  it('does not schedule a check while the last one is still fresh', async () => {
    const h = harness();
    await writeUpdateCache(h.cacheFile, { lastCheckedAt: FRESH, latestVersion: '1.12.0' });
    await h.run();
    expect(h.printed).toHaveLength(1);
    expect(h.scheduled).toEqual([]);
  });

  it('keeps piped output clean', async () => {
    const h = harness({ isTty: false });
    await writeUpdateCache(h.cacheFile, { lastCheckedAt: STALE, latestVersion: '1.12.0' });
    await h.run();
    expect(h.printed).toEqual([]);
  });

  it('does nothing at all when it is switched off', async () => {
    for (const overrides of [{ enabled: false }, { env: { CI: 'true' } }, { env: { MIO_NO_UPDATE_NOTIFIER: '1' } }]) {
      const h = harness(overrides);
      await writeUpdateCache(h.cacheFile, { lastCheckedAt: STALE, latestVersion: '1.12.0' });
      await h.run();
      expect(h.printed).toEqual([]);
      expect(h.scheduled).toEqual([]);
    }
  });

  it('does nothing when the package does not point at GitHub', async () => {
    const h = harness({ repositoryUrl: 'https://example.invalid/mio-cli.git' });
    await writeUpdateCache(h.cacheFile, { lastCheckedAt: STALE, latestVersion: '1.12.0' });
    await h.run();
    expect(h.printed).toEqual([]);
    expect(h.scheduled).toEqual([]);
  });

  it('never lets its own failure reach the user', async () => {
    const h = harness({ scheduleCheck: () => { throw new Error('spawn refused'); } });
    await expect(h.run()).resolves.toBeUndefined();
  });
});
