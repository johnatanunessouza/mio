import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const executable = path.join(root, 'bin', 'mio.js');

let project: string;
beforeEach(() => { project = mkdtempSync(path.join(tmpdir(), 'mio-init-tools-')); });
afterEach(() => { rmSync(project, { recursive: true, force: true }); });

function init(...args: string[]) {
  return spawnSync(process.execPath, [executable, 'init', project, '--no-animation', ...args], { cwd: root, encoding: 'utf8' });
}

describe('mio init --tools', () => {
  it('installs the codegraph skill for every selected agent without touching the machine in dry run', () => {
    const result = init('--agents', 'claude,github-copilot', '--tools', 'codegraph', '--dry-run');
    expect(result.status).toBe(0);
    expect(existsSync(path.join(project, '.claude', 'skills', 'codegraph', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(project, '.github', 'skills', 'codegraph', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(project, '.codegraph', 'codegraph.db'))).toBe(false);
    expect(result.stdout).toContain('would run `codegraph init`');
  });

  it('reports the copilot MCP targets without writing them in dry run', () => {
    const result = init('--agents', 'github-copilot', '--tools', 'codegraph', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.join('.vscode', 'mcp.json'));
    expect(result.stdout).toContain(path.join('.github', 'mcp.json'));
    expect(existsSync(path.join(project, '.vscode', 'mcp.json'))).toBe(false);
    expect(existsSync(path.join(project, '.github', 'mcp.json'))).toBe(false);
  });

  it('never writes the root .mcp.json, which other agents share', () => {
    expect(init('--agents', 'github-copilot', '--tools', 'codegraph', '--dry-run').status).toBe(0);
    expect(existsSync(path.join(project, '.mcp.json'))).toBe(false);
  });

  it('omits copilot MCP config when copilot is not selected', () => {
    const result = init('--agents', 'claude', '--tools', 'codegraph', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Copilot MCP');
    expect(existsSync(path.join(project, '.vscode', 'mcp.json'))).toBe(false);
    expect(existsSync(path.join(project, '.mcp.json'))).toBe(false);
  });

  it('keeps the codegraph index out of git without writing it in dry run', () => {
    const result = init('--agents', 'claude', '--tools', 'codegraph', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.join('.codegraph', '.gitignore'));
    expect(existsSync(path.join(project, '.codegraph', '.gitignore'))).toBe(false);
  });

  it('passes the mapped agent list to openspec', () => {
    const result = init('--agents', 'claude,devin', '--tools', 'openspec', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('openspec init --tools claude,windsurf');
  });

  it('reports the archive guidance it would write once code-review is installed', () => {
    mkdirSync(path.join(project, '.claude', 'skills', 'code-review'), { recursive: true });
    mkdirSync(path.join(project, 'openspec'), { recursive: true });
    writeFileSync(path.join(project, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8');
    const result = init('--agents', 'claude', '--tools', 'openspec', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('would write archive — from: code-review');
    expect(readFileSync(path.join(project, 'openspec', 'config.yaml'), 'utf8')).toBe('schema: spec-driven\n');
  });

  it('skips the guidance step when no installed skill contributes any', () => {
    const result = init('--agents', 'claude', '--tools', 'openspec', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no installed skill contributes guidance');
  });

  it('reports agents openspec cannot configure', () => {
    const result = init('--agents', 'claude,zed', '--tools', 'openspec', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OpenSpec has no tool for: zed');
  });

  it('configures agents only when no tool is selected', () => {
    const result = init('--agents', 'claude', '--tools', 'none');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('mio initialized');
    expect(existsSync(path.join(project, '.claude', 'skills', 'codegraph'))).toBe(false);
  });

  it('rejects an unknown tool id', () => {
    const result = init('--agents', 'claude', '--tools', 'nope');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown tool: nope');
  });

  it('is idempotent across repeated runs', () => {
    expect(init('--agents', 'claude', '--tools', 'codegraph', '--dry-run').status).toBe(0);
    const second = init('--agents', 'claude', '--tools', 'codegraph', '--dry-run');
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already up to date');
  });

  it('reports the caveman agents it would instrument without touching the machine in dry run', () => {
    const result = init('--agents', 'claude,codex', '--tools', 'caveman', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('would instrument claude, codex');
    expect(result.stdout).toContain('would run `caveman setup --install`');
  });

  it('reports agents caveman cannot instrument', () => {
    const result = init('--agents', 'claude,cursor', '--tools', 'caveman', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Caveman has no profile for: cursor');
  });

  it('skips caveman entirely when no selected agent has a profile', () => {
    const result = init('--agents', 'cursor', '--tools', 'caveman', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('none of the selected agents map to a Caveman profile');
  });

  it('reports the caveman skills command it would run without touching the machine in dry run', () => {
    const result = init('--agents', 'claude,codex', '--tools', 'caveman-skills', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('add JuliusBrussee/caveman --skill * --agent claude-code,codex --yes --copy');
    expect(existsSync(path.join(project, '.claude', 'skills', 'caveman'))).toBe(false);
  });

  it('reports agents the Skills CLI cannot target', () => {
    const result = init('--agents', 'claude,amazon-q', '--tools', 'caveman-skills', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('the Skills CLI has no target for: amazon-q');
  });

  it('skips the caveman skill suite when no selected agent has a target', () => {
    const result = init('--agents', 'amazon-q', '--tools', 'caveman-skills', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('none of the selected agents map to a Skills CLI target');
  });

  it('writes the agents block even when no tool is selected', () => {
    const result = init('--agents', 'claude,github-copilot', '--tools', 'none');
    expect(result.status).toBe(0);
    const ignored = readFileSync(path.join(project, '.gitignore'), 'utf8');
    expect(ignored).toContain('## Agents ##');
    expect(ignored).toContain('.claude');
    expect(ignored).toContain('.github');
    expect(ignored).toContain('.codegraph');
  });

  it('writes the agents block after a tool install too', () => {
    expect(init('--agents', 'claude', '--tools', 'codegraph', '--dry-run').status).toBe(0);
    expect(readFileSync(path.join(project, '.gitignore'), 'utf8')).toContain('## Agents ##');
  });

  it('merges into an existing .gitignore across reruns without duplicating the block', () => {
    writeFileSync(path.join(project, '.gitignore'), 'node_modules\n');
    expect(init('--agents', 'claude', '--tools', 'none').status).toBe(0);
    expect(init('--agents', 'cursor', '--tools', 'none').status).toBe(0);
    const ignored = readFileSync(path.join(project, '.gitignore'), 'utf8');
    expect(ignored.match(/## Agents ##/g)).toHaveLength(1);
    expect(ignored).toContain('node_modules');
    expect(ignored).toContain('.claude');
    expect(ignored).toContain('.cursor');
  });
});
