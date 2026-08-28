import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installCommandsForAgents, renderCommand, resolveCommandTarget } from '../../../src/core/skills/commands.js';
import { resolveAgents } from '../../../src/core/agents/registry.js';
import { SKILL_CATALOG } from '../../../src/core/skills/registry.js';

const [agentsCreate] = SKILL_CATALOG;

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-command-test-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('resolveCommandTarget', () => {
  it('uses a namespace directory for claude', () => {
    const [claude] = resolveAgents(['claude']);
    expect(resolveCommandTarget(claude, root, 'agents-create')).toEqual({
      path: path.join(root, '.claude', 'commands', 'mio', 'agents-create.md'),
      invocation: '/mio:agents-create',
    });
  });

  it('uses a prefixed file and the prompt suffix for copilot', () => {
    const [copilot] = resolveAgents(['github-copilot']);
    expect(resolveCommandTarget(copilot, root, 'agents-create')).toEqual({
      path: path.join(root, '.github', 'prompts', 'mio-agents-create.prompt.md'),
      invocation: '/mio-agents-create',
    });
  });

  it('falls back to <skillsDir>/commands for agents without an override', () => {
    const [gemini] = resolveAgents(['gemini']);
    expect(resolveCommandTarget(gemini, root, 'agents-create')?.path)
      .toBe(path.join(root, '.gemini', 'commands', 'mio', 'agents-create.md'));
  });

  it('skips agents with no local skills directory', () => {
    const [minimax] = resolveAgents(['minimax-code']);
    expect(resolveCommandTarget(minimax, root, 'agents-create')).toBeUndefined();
  });

  it('refuses a destination outside the project root', () => {
    const [claude] = resolveAgents(['claude']);
    expect(() => resolveCommandTarget({ ...claude, commandsDir: '../escape' }, root, 'agents-create'))
      .toThrow(/outside the allowed target root/);
  });
});

describe('renderCommand', () => {
  const [command] = agentsCreate.commands;

  it('carries the namespaced name for namespace-dir agents', () => {
    const [claude] = resolveAgents(['claude']);
    expect(renderCommand(claude, command, 'body')).toBe(
      `---\nname: "mio:agents-create"\ndescription: ${command.description}\n---\n\nbody`
    );
  });

  it('emits description-only frontmatter for flat command directories', () => {
    const [copilot] = resolveAgents(['github-copilot']);
    expect(renderCommand(copilot, command, 'body')).toBe(`---\ndescription: ${command.description}\n---\n\nbody`);
  });
});

describe('installCommandsForAgents', () => {
  it('writes one file per agent with the right invocation', async () => {
    const installed = await installCommandsForAgents(agentsCreate.commands, resolveAgents(['claude', 'github-copilot']), root);
    expect(installed.map((entry) => entry.invocation)).toEqual(['/mio:agents-create', '/mio-agents-create']);
    expect(installed.every((entry) => entry.changed)).toBe(true);
    const claudeFile = readFileSync(path.join(root, '.claude', 'commands', 'mio', 'agents-create.md'), 'utf8');
    expect(claudeFile).toContain('name: "mio:agents-create"');
    expect(claudeFile).toContain('agents-md.sh --list');
  });

  it('writes agents sharing a command directory only once', async () => {
    const installed = await installCommandsForAgents(agentsCreate.commands, resolveAgents(['codex', 'zed', 'agents']), root);
    expect(installed).toHaveLength(1);
    expect(installed[0].path).toBe(path.join(root, '.agents', 'commands', 'mio', 'agents-create.md'));
  });

  it('is idempotent on a second run', async () => {
    await installCommandsForAgents(agentsCreate.commands, resolveAgents(['claude']), root);
    const [second] = await installCommandsForAgents(agentsCreate.commands, resolveAgents(['claude']), root);
    expect(second.changed).toBe(false);
  });
});
