import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { readUpdateCache, updateCachePath, type UpdateCacheState } from './cache.js';
import { parseRepositorySlug, type RepositorySlug } from './release.js';
import { isNewerVersion } from './version.js';

/** How long a check result is trusted before another one is scheduled. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Environments that must never see the notice: explicit opt-out, CI, and test
 * runs. `NO_UPDATE_NOTIFIER` is honoured because it is the variable the
 * ecosystem already standardised on.
 */
export function isUpdateCheckDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.MIO_NO_UPDATE_NOTIFIER || env.NO_UPDATE_NOTIFIER || env.CI || env.NODE_ENV === 'test');
}

/** Whether a fresh check is due. A timestamp in the future means the clock moved: check again. */
export function shouldCheck(
  state: UpdateCacheState | undefined,
  now: number,
  interval = UPDATE_CHECK_INTERVAL_MS
): boolean {
  if (!state) return true;
  const elapsed = now - state.lastCheckedAt;
  return elapsed >= interval || elapsed < 0;
}

/** The command that installs a specific release, pinned so it matches the version being announced. */
export function updateCommand(slug: RepositorySlug, packageName: string, version: string): string {
  const asset = `${packageName}-${version}.tgz`;
  return `npm install -g https://github.com/${slug.owner}/${slug.repo}/releases/download/v${version}/${asset}`;
}

export function renderUpdateNotice(notice: { current: string; latest: string; command: string }): string {
  return [
    '',
    `  ${chalk.yellow('Update available')} ${chalk.dim(notice.current)} ${chalk.dim('→')} ${chalk.green(notice.latest)}`,
    `  ${chalk.dim('Update with')} ${chalk.cyan(notice.command)}`,
    ''
  ].join('\n');
}

export interface NotifyAboutUpdateOptions {
  currentVersion: string;
  packageName: string;
  /** package.json `repository.url`. A non-GitHub URL disables the notifier. */
  repositoryUrl?: string;
  /** `false` when the run passed `--no-update-check`. */
  enabled?: boolean;
  env?: NodeJS.ProcessEnv;
  now?: number;
  /** Only a real terminal gets the notice, so piped output stays machine-readable. */
  isTty?: boolean;
  cacheFile?: string;
  write?: (message: string) => void;
  scheduleCheck?: (slug: RepositorySlug, cacheFile: string) => void;
}

/**
 * Report what the *previous* check found and schedule the next one.
 *
 * The current run never waits on the network: it prints from cache and hands
 * the lookup to a detached process, so a slow or unreachable GitHub cannot
 * delay — or fail — the command the user actually asked for.
 */
export async function notifyAboutUpdate(options: NotifyAboutUpdateOptions): Promise<void> {
  const {
    currentVersion,
    packageName,
    repositoryUrl,
    enabled = true,
    env = process.env,
    now = Date.now(),
    isTty = Boolean(process.stdout.isTTY),
    write = (message: string) => console.log(message),
    scheduleCheck = spawnBackgroundCheck
  } = options;

  try {
    if (!enabled || isUpdateCheckDisabled(env)) return;
    const slug = parseRepositorySlug(repositoryUrl);
    if (!slug) return;

    const cacheFile = options.cacheFile ?? updateCachePath(env);
    const state = await readUpdateCache(cacheFile);

    if (isTty && state?.latestVersion && isNewerVersion(state.latestVersion, currentVersion)) {
      write(
        renderUpdateNotice({
          current: currentVersion,
          latest: state.latestVersion,
          command: updateCommand(slug, packageName, state.latestVersion)
        })
      );
    }

    if (shouldCheck(state, now)) scheduleCheck(slug, cacheFile);
  } catch {
    // A notifier that breaks the CLI is worse than no notifier.
  }
}

function spawnBackgroundCheck(slug: RepositorySlug, cacheFile: string): void {
  try {
    const worker = fileURLToPath(new URL('./check.js', import.meta.url));
    const child = spawn(process.execPath, [worker, `${slug.owner}/${slug.repo}`, cacheFile], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } catch {
    // Ignored: the check is best effort.
  }
}
