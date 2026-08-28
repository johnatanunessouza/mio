import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { access, constants } from 'node:fs/promises';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  /** Stream child output straight to the terminal instead of capturing it. */
  inherit?: boolean;
  env?: NodeJS.ProcessEnv;
}

/** Run a command to completion without ever rejecting on a non-zero exit. */
export function run(command: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error: NodeJS.ErrnoException) => {
      resolve({ code: error.code === 'ENOENT' ? 127 : 1, stdout, stderr: stderr + String(error.message) });
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

const executableExtensions = process.platform === 'win32'
  ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  : [''];

/** Resolve an executable on PATH, returning its absolute path or undefined. */
export async function which(binary: string, env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  for (const directory of (env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const extension of executableExtensions) {
      const candidate = join(directory, binary + extension);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return undefined;
}
