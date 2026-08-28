import chalk from 'chalk';
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { WELCOME_ANIMATION } from './ascii-patterns.js';

const MIN_WIDTH = 60;
const ART_COLUMN_WIDTH = 24;

function getWelcomeText(waitForInput: boolean): string[] {
  return [
    chalk.white.bold('Welcome to mio'),
    chalk.dim('A reusable foundation for agent-ready projects'),
    '',
    chalk.white('This setup will:'),
    chalk.dim('  • Show the supported agents'),
    chalk.dim('  • Let you select one or more integrations'),
    chalk.dim('  • Configure their local extension paths'),
    '',
    ...(waitForInput ? [chalk.cyan('Press Enter to select agents...')] : []),
  ];
}

function renderFrame(artLines: readonly string[], textLines: readonly string[]): string {
  const maxLines = Math.max(artLines.length, textLines.length);
  const lines: string[] = [];

  for (let index = 0; index < maxLines; index += 1) {
    const artLine = artLines[index] ?? '';
    const textLine = textLines[index] ?? '';
    lines.push(`\x1b[2K${chalk.cyan(artLine.padEnd(ART_COLUMN_WIDTH))}${textLine}`);
  }

  return lines.join('\n');
}

const REDUCED_MOTION_EXEC_OPTIONS: ExecFileSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  timeout: 500,
  killSignal: 'SIGKILL',
  stdio: ['ignore', 'pipe', 'ignore'],
};

export function prefersReducedMotion(platform: NodeJS.Platform = process.platform): boolean {
  try {
    if (platform === 'darwin') {
      return execFileSync(
        'defaults',
        ['read', 'com.apple.universalaccess', 'reduceMotion'],
        REDUCED_MOTION_EXEC_OPTIONS
      ).trim() === '1';
    }
    if (platform === 'linux') {
      return execFileSync(
        'gsettings',
        ['get', 'org.gnome.desktop.interface', 'enable-animations'],
        REDUCED_MOTION_EXEC_OPTIONS
      ).trim() === 'false';
    }
  } catch {
    // Reduced-motion detection is best effort only.
  }
  return false;
}

function canAnimate(): boolean {
  if (!process.stdout.isTTY || process.env.NO_COLOR || process.env.MIO_NO_ANIMATION !== undefined) return false;
  if ((process.stdout.columns || 80) < MIN_WIDTH) return false;
  return !prefersReducedMotion();
}

async function waitForEnter(): Promise<void> {
  const { createPrompt, isEnterKey, useKeypress } = await import('@inquirer/core');
  const prompt = createPrompt<void, Record<string, never>>((_config, done) => {
    useKeypress((key) => {
      if (key.ctrl && key.name === 'c') {
        process.stdout.write('\n');
        process.exit(0);
      }
      if (isEnterKey(key)) done(undefined);
    });
    return '';
  });
  await prompt({});
}

export interface WelcomeScreenOptions {
  animate?: boolean;
  waitForInput?: boolean;
}

export async function showWelcomeScreen(options: WelcomeScreenOptions = {}): Promise<void> {
  const waitForInput = options.waitForInput ?? Boolean(process.stdin.isTTY);
  const textLines = getWelcomeText(waitForInput);
  const shouldAnimate = options.animate !== false && waitForInput && canAnimate();

  if (!shouldAnimate) {
    const frame = WELCOME_ANIMATION.frames.at(-1)!;
    process.stdout.write(`\n${renderFrame(frame, textLines)}\n\n`);
    if (waitForInput) await waitForEnter();
    return;
  }

  let frameIndex = 0;
  let firstRender = true;
  const contentLines = Math.max(WELCOME_ANIMATION.frames[0].length, textLines.length);
  const frameHeight = contentLines + 1;
  const totalHeight = frameHeight + 1;

  process.stdout.write('\n');
  const interval = setInterval(() => {
    const frame = WELCOME_ANIMATION.frames[frameIndex];
    if (!firstRender) process.stdout.write(`\x1b[${frameHeight}A`);
    firstRender = false;
    process.stdout.write(`${renderFrame(frame, textLines)}\n\n`);
    frameIndex = (frameIndex + 1) % WELCOME_ANIMATION.frames.length;
  }, WELCOME_ANIMATION.interval);

  try {
    await waitForEnter();
  } finally {
    clearInterval(interval);
  }

  process.stdout.write(`\x1b[${totalHeight}A`);
  for (let index = 0; index < totalHeight; index += 1) process.stdout.write('\x1b[2K\n');
  process.stdout.write(`\x1b[${totalHeight}A`);
}
