import { describe, expect, it } from 'vitest';
import { fetchLatestRelease, parseRepositorySlug } from '../../../src/core/update/release.js';

/** A `fetch` stand-in that answers with one payload, or fails. */
function stubFetch(reply: () => Promise<unknown>): typeof fetch {
  return (async () => await reply()) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('parseRepositorySlug', () => {
  it('reads the owner and repo out of every spelling package.json uses', () => {
    const expected = { owner: 'johnatanunessouza', repo: 'mio' };
    expect(parseRepositorySlug('git+https://github.com/johnatanunessouza/mio.git')).toEqual(expected);
    expect(parseRepositorySlug('https://github.com/johnatanunessouza/mio')).toEqual(expected);
    expect(parseRepositorySlug('git@github.com:johnatanunessouza/mio.git')).toEqual(expected);
    expect(parseRepositorySlug('https://github.com/johnatanunessouza/mio/')).toEqual(expected);
  });

  it('declines anything that is not GitHub, which disables the notifier', () => {
    expect(parseRepositorySlug(undefined)).toBeUndefined();
    expect(parseRepositorySlug('https://example.invalid/mio-cli.git')).toBeUndefined();
    expect(parseRepositorySlug('git+https://gitlab.com/owner/repo.git')).toBeUndefined();
  });
});

describe('fetchLatestRelease', () => {
  const slug = { owner: 'owner', repo: 'repo' };

  it('returns the tag of the latest release, without the prefix', async () => {
    const latest = await fetchLatestRelease(slug, {
      fetchImpl: stubFetch(async () => jsonResponse({ tag_name: 'v1.12.0' }))
    });
    expect(latest).toBe('1.12.0');
  });

  it('asks GitHub for the latest release of that repository', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const recordingFetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return jsonResponse({ tag_name: 'v1.12.0' });
    }) as unknown as typeof fetch;
    await fetchLatestRelease(slug, { fetchImpl: recordingFetch, userAgent: 'mio-cli/1.11.0' });
    expect(seen[0].url).toBe('https://api.github.com/repos/owner/repo/releases/latest');
    expect((seen[0].init?.headers as Record<string, string>)['user-agent']).toBe('mio-cli/1.11.0');
  });

  it('stays quiet when the request fails, is rate limited, or times out', async () => {
    expect(await fetchLatestRelease(slug, { fetchImpl: stubFetch(async () => { throw new Error('offline'); }) })).toBeUndefined();
    expect(await fetchLatestRelease(slug, { fetchImpl: stubFetch(async () => jsonResponse({}, false, 403)) })).toBeUndefined();
  });

  it('stays quiet on a payload it cannot trust', async () => {
    expect(await fetchLatestRelease(slug, { fetchImpl: stubFetch(async () => jsonResponse(null)) })).toBeUndefined();
    expect(await fetchLatestRelease(slug, { fetchImpl: stubFetch(async () => jsonResponse({ tag_name: '' })) })).toBeUndefined();
    expect(await fetchLatestRelease(slug, { fetchImpl: stubFetch(async () => jsonResponse({ tag_name: 'v2.0.0', draft: true })) })).toBeUndefined();
    expect(await fetchLatestRelease(slug, { fetchImpl: stubFetch(async () => jsonResponse({ tag_name: 'v2.0.0', prerelease: true })) })).toBeUndefined();
  });
});
