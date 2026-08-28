import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const executable = path.join(root, 'bin', 'mio.js');

function run(...args: string[]) {
  return spawnSync(process.execPath, [executable, ...args], { cwd: root, encoding: 'utf8' });
}

describe('mio executable', () => {
  it('displays neutral help and version', () => {
    const help = run('--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('mio');
    expect(help.stdout).toContain('init');
    expect(help.stdout).toContain('agent');

    const version = run('--version');
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toMatch(/^1\.11\.0$/);
  });

  it.each(['spec', 'change', 'archive'])('rejects removed %s commands', (legacyCommand) => {
    const result = run(legacyCommand);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`unknown command '${legacyCommand}'`);
  });

  it('executes the package binary directly', () => {
    const result = run('agent', 'list', '--json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).agents.some((agent: { id: string }) => agent.id === 'codex')).toBe(true);
  });

  it('initializes selected agents non-interactively', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'mio-init-smoke-'));
    try {
      const result = run('init', target, '--agents', 'codex', '--no-animation');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('mio initialized');
      expect(result.stdout).toContain('Codex');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});
