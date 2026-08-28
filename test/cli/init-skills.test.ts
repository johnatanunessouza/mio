import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const executable = path.join(root, 'bin', 'mio.js');

let project: string;
beforeEach(() => { project = mkdtempSync(path.join(tmpdir(), 'mio-init-skills-')); });
afterEach(() => { rmSync(project, { recursive: true, force: true }); });

function run(...args: string[]) {
  return spawnSync(process.execPath, [executable, ...args], { cwd: root, encoding: 'utf8' });
}

function init(...args: string[]) {
  return run('init', project, '--no-animation', '--tools', 'none', ...args);
}

describe('mio init default skills', () => {
  it('installs agents-create and its command for every selected agent', () => {
    const result = init('--agents', 'claude,github-copilot');
    expect(result.status).toBe(0);
    expect(existsSync(path.join(project, '.claude', 'skills', 'agents-create', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(project, '.claude', 'skills', 'agents-create', 'scripts', 'agents-md.sh'))).toBe(true);
    expect(existsSync(path.join(project, '.github', 'skills', 'agents-create', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(project, '.claude', 'commands', 'mio', 'agents-create.md'))).toBe(true);
    expect(existsSync(path.join(project, '.github', 'prompts', 'mio-agents-create.prompt.md'))).toBe(true);
    expect(result.stdout).toContain('/mio:agents-create');
    expect(result.stdout).toContain('/mio-agents-create');
  });

  it('installs skills even when no tool is selected', () => {
    expect(init('--agents', 'claude').status).toBe(0);
    expect(existsSync(path.join(project, '.claude', 'skills', 'agents-create', 'SKILL.md'))).toBe(true);
  });

  it('opts out with --skills none', () => {
    const result = init('--agents', 'claude', '--skills', 'none');
    expect(result.status).toBe(0);
    expect(existsSync(path.join(project, '.claude', 'skills', 'agents-create'))).toBe(false);
    expect(existsSync(path.join(project, '.claude', 'commands'))).toBe(false);
    expect(result.stdout).not.toContain('/mio:agents-create');
  });

  it('reports an unknown skill instead of writing a partial install', () => {
    const result = init('--agents', 'claude', '--skills', 'nope');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown skill: nope');
    expect(existsSync(path.join(project, '.claude', 'commands'))).toBe(false);
  });

  it('reports every path as up to date on a second run', () => {
    expect(init('--agents', 'claude').status).toBe(0);
    const second = init('--agents', 'claude');
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already up to date');
  });
});

describe('mio skill', () => {
  it('lists bundled skills with their invocation', () => {
    const result = run('skill', 'list');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('agents-create');
    expect(result.stdout).toContain('/mio:agents-create');
  });

  it('installs a skill on its own', () => {
    const result = run('skill', 'install', project, '--agents', 'claude');
    expect(result.status).toBe(0);
    expect(readFileSync(path.join(project, '.claude', 'commands', 'mio', 'agents-create.md'), 'utf8'))
      .toContain('name: "mio:agents-create"');
  });
});

describe('mio init default instructions', () => {
  it('merges the response protocol into the file each agent loads', () => {
    const result = init('--agents', 'claude,codex,github-copilot');
    expect(result.status).toBe(0);
    expect(readFileSync(path.join(project, 'CLAUDE.md'), 'utf8')).toContain('STATUS: SUCCESS | PARTIAL | FAILED');
    expect(readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toContain('PROXIMA_ACAO');
    expect(readFileSync(path.join(project, '.github', 'copilot-instructions.md'), 'utf8')).toContain('RESUMO');
    expect(result.stdout).toContain('Response protocol');
  });

  it('opts out with --instructions none', () => {
    expect(init('--agents', 'claude', '--instructions', 'none').status).toBe(0);
    expect(existsSync(path.join(project, 'CLAUDE.md'))).toBe(false);
  });

  it('reports an unknown instruction', () => {
    const result = init('--agents', 'claude', '--instructions', 'nope');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown instruction: nope');
  });

  it('lists bundled instructions', () => {
    const result = run('instructions', 'list');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('response-protocol');
  });
});
