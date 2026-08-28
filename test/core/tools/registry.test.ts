import { describe, expect, it } from 'vitest';
import { listTools, resolveTools } from '../../../src/core/tools/registry.js';
import { mapAgentsToOpenspecTools } from '../../../src/core/tools/openspec.js';
import { mapAgentsToCavemanAgents } from '../../../src/core/tools/caveman.js';
import { buildAddArgs, mapAgentsToSkillsAgents } from '../../../src/core/tools/caveman-skills.js';
import { resolveAgents } from '../../../src/core/agents/registry.js';

describe('tool registry', () => {
  it('exposes every installable tool in menu order', () => {
    expect(listTools().map((tool) => tool.id)).toEqual(['codegraph', 'openspec', 'caveman', 'caveman-skills']);
  });

  it('resolves ids case-insensitively and de-duplicates', () => {
    expect(resolveTools(['OpenSpec', 'openspec']).map((installer) => installer.definition.id)).toEqual(['openspec']);
  });

  it('rejects unknown ids', () => {
    expect(() => resolveTools(['nope'])).toThrow(/Unknown tool: nope/);
  });
});

describe('openspec tool mapping', () => {
  it('maps mio agent ids onto openspec --tools ids', () => {
    const { tools, unsupported } = mapAgentsToOpenspecTools(resolveAgents(['claude', 'devin', 'github-copilot']));
    expect(tools).toEqual(['claude', 'github-copilot', 'windsurf']);
    expect(unsupported).toEqual([]);
  });

  it('reports agents openspec does not support instead of dropping them silently', () => {
    const { tools, unsupported } = mapAgentsToOpenspecTools(resolveAgents(['claude', 'zed', 'hermes']));
    expect(tools).toEqual(['claude']);
    expect(unsupported).toEqual(['hermes', 'zed']);
  });

  it('de-duplicates agents that collapse to the same openspec tool', () => {
    const { tools } = mapAgentsToOpenspecTools(resolveAgents(['devin', 'windsurf']));
    expect(tools).toEqual(['windsurf']);
  });
});

describe('caveman agent mapping', () => {
  it('maps mio agent ids onto caveman profile ids', () => {
    const { agents, unsupported } = mapAgentsToCavemanAgents(resolveAgents(['claude', 'codex', 'oh-my-pi']));
    expect(agents).toEqual(['claude', 'codex', 'pi']);
    expect(unsupported).toEqual([]);
  });

  it('reports agents caveman has no profile for instead of dropping them silently', () => {
    const { agents, unsupported } = mapAgentsToCavemanAgents(resolveAgents(['claude', 'cursor', 'zed']));
    expect(agents).toEqual(['claude']);
    expect(unsupported).toEqual(['cursor', 'zed']);
  });

  it('separates hookable and agent-native agents from the full profile list', () => {
    const { agents, hookable, agentNative } = mapAgentsToCavemanAgents(resolveAgents(['claude', 'gemini']));
    expect(agents).toEqual(['claude', 'gemini']);
    expect(hookable).toEqual(['claude', 'gemini']);
    expect(agentNative).toEqual(['claude']);
  });

  it('excludes aider from hooks because caveman only documents a manual setup for it', () => {
    const aider = { id: 'aider', name: 'Aider', available: true } as const;
    const { agents, hookable } = mapAgentsToCavemanAgents([aider]);
    expect(agents).toEqual(['aider']);
    expect(hookable).toEqual([]);
  });
});

describe('caveman skills agent mapping', () => {
  it('maps mio agent ids onto Skills CLI agent ids', () => {
    const { agents, unsupported } = mapAgentsToSkillsAgents(resolveAgents(['claude', 'gemini', 'factory', 'agents']));
    expect(agents).toEqual(['claude-code', 'droid', 'gemini-cli', 'universal']);
    expect(unsupported).toEqual([]);
  });

  it('passes agents the Skills CLI names identically straight through', () => {
    const { agents, unsupported } = mapAgentsToSkillsAgents(resolveAgents(['codex', 'cursor', 'zed']));
    expect(agents).toEqual(['codex', 'cursor', 'zed']);
    expect(unsupported).toEqual([]);
  });

  it('reports agents the Skills CLI cannot target instead of dropping them silently', () => {
    const { agents, unsupported } = mapAgentsToSkillsAgents(resolveAgents(['claude', 'amazon-q', 'costrict']));
    expect(agents).toEqual(['claude-code']);
    expect(unsupported).toEqual(['amazon-q', 'costrict']);
  });

  it('does not route oh-my-pi to pi, whose skills live in a different directory', () => {
    const { agents, unsupported } = mapAgentsToSkillsAgents(resolveAgents(['oh-my-pi']));
    expect(agents).toEqual([]);
    expect(unsupported).toEqual(['oh-my-pi']);
  });

  it('builds a non-interactive add command for the whole suite', () => {
    expect(buildAddArgs(['claude-code', 'codex'])).toEqual([
      'add', 'JuliusBrussee/caveman', '--skill', '*', '--agent', 'claude-code,codex', '--yes', '--copy',
    ]);
  });
});
