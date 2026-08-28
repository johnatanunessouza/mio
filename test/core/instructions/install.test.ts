import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installInstructions, resolveInstructionsPath } from '../../../src/core/instructions/install.js';
import { resolveInstructions } from '../../../src/core/instructions/registry.js';
import { resolveAgents } from '../../../src/core/agents/registry.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-instructions-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const install = (ids: string[], global = false, globalHome?: string) => installInstructions({
  projectRoot: root,
  agents: resolveAgents(ids),
  instructionIds: ['response-protocol'],
  global,
  globalHome,
});

describe('resolveInstructionsPath', () => {
  it('defaults to AGENTS.md, the file most agents read', () => {
    const [codex] = resolveAgents(['codex']);
    expect(resolveInstructionsPath(codex, root)).toBe(path.join(root, 'AGENTS.md'));
  });

  it('uses the file an agent declares for itself', () => {
    expect(resolveInstructionsPath(resolveAgents(['claude'])[0], root)).toBe(path.join(root, 'CLAUDE.md'));
    expect(resolveInstructionsPath(resolveAgents(['gemini'])[0], root)).toBe(path.join(root, 'GEMINI.md'));
    expect(resolveInstructionsPath(resolveAgents(['github-copilot'])[0], root))
      .toBe(path.join(root, '.github', 'copilot-instructions.md'));
  });

  it('returns undefined in global mode for agents with no global file', () => {
    expect(resolveInstructionsPath(resolveAgents(['cursor'])[0], root, true, root)).toBeUndefined();
    expect(resolveInstructionsPath(resolveAgents(['claude'])[0], root, true, root))
      .toBe(path.join(root, '.claude', 'CLAUDE.md'));
  });
});

describe('installInstructions', () => {
  it('writes one file per distinct target', async () => {
    const installed = await install(['claude', 'codex', 'github-copilot']);
    expect(installed.map((entry) => path.relative(root, entry.path))).toEqual([
      'CLAUDE.md',
      'AGENTS.md',
      path.join('.github', 'copilot-instructions.md'),
    ]);
    expect(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toContain('STATUS: SUCCESS | PARTIAL | FAILED');
  });

  it('writes agents sharing a target only once', async () => {
    const installed = await install(['codex', 'zed', 'cursor']);
    expect(installed).toHaveLength(1);
    expect(installed[0].path).toBe(path.join(root, 'AGENTS.md'));
  });

  it('merges into an existing file without losing its content', async () => {
    writeFileSync(path.join(root, 'AGENTS.md'), '# Meu projeto\n\nregras próprias\n', 'utf8');
    const [installed] = await install(['codex']);
    expect(installed.merged).toBe(true);
    const content = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(content).toContain('regras próprias');
    expect(content).toContain('<!-- BEGIN MIO: response-protocol -->');
  });

  it('is idempotent on a second run', async () => {
    await install(['claude']);
    const [second] = await install(['claude']);
    expect(second.changed).toBe(false);
  });

  it('writes into the home tree in global mode', async () => {
    const installed = await installInstructions({
      projectRoot: path.join(root, 'project'),
      agents: resolveAgents(['claude', 'cursor']),
      instructionIds: ['response-protocol'],
      global: true,
      globalHome: root,
    });
    expect(installed).toHaveLength(1);
    expect(installed[0].path).toBe(path.join(root, '.claude', 'CLAUDE.md'));
    expect(existsSync(path.join(root, 'project'))).toBe(false);
  });

  it('rejects an unknown instruction', () => {
    expect(() => resolveInstructions(['nope'])).toThrow(/Unknown instruction: nope/);
  });
});
