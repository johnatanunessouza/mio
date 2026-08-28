import { normalizeVersion } from './version.js';

export interface RepositorySlug {
  owner: string;
  repo: string;
}

/**
 * The `owner/repo` behind a package.json `repository.url`, or `undefined` when
 * it does not point at GitHub — the only host this notifier knows how to query.
 */
export function parseRepositorySlug(repositoryUrl: string | undefined): RepositorySlug | undefined {
  if (!repositoryUrl) return undefined;
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repositoryUrl.trim());
  if (!match) return undefined;
  return { owner: match[1], repo: match[2] };
}

export interface FetchLatestReleaseOptions {
  /** Abort the request after this long. The check runs detached, but it must not linger. */
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

/**
 * The newest published release of the repository, or `undefined` when the
 * answer cannot be trusted — offline, rate limited, no release yet, malformed
 * payload. Never throws: a failed check is a silent no-op, not an error.
 *
 * `/releases/latest` already excludes drafts and pre-releases; the guard below
 * only defends against a payload that says otherwise.
 */
export async function fetchLatestRelease(
  slug: RepositorySlug,
  options: FetchLatestReleaseOptions = {}
): Promise<string | undefined> {
  const { timeoutMs = 3000, userAgent = 'mio-cli', fetchImpl = fetch } = options;
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${slug.owner}/${slug.repo}/releases/latest`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': userAgent
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null) return undefined;
    const { tag_name: tag, draft, prerelease } = payload as Record<string, unknown>;
    if (draft === true || prerelease === true) return undefined;
    if (typeof tag !== 'string' || tag.trim() === '') return undefined;
    return normalizeVersion(tag);
  } catch {
    return undefined;
  }
}
