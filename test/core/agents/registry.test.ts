import baseline from '../../../../openspec/changes/archive/2026-08-27-extract-generic-cli-skeleton/baselines/agent-catalog.json';
import { describe, expect, it } from 'vitest';
import { AGENT_ALIASES, listAgents, resolveAgentId, resolveAgents } from '../../../src/core/agents/registry.js';

/**
 * Deliberate departures from the archived baseline. The baseline records what
 * the catalog held when it was extracted, so it stays as written; a fix that
 * post-dates it is declared here instead of rewriting the archive.
 */
const baselineCorrections: Record<string, { detectionPaths: string[] }> = {
  // Copilot reads `.github/mcp.json`; the baseline carries a stray dot.
  'github-copilot': {
    detectionPaths: [
      '.github/copilot-instructions.md', '.github/instructions', '.github/workflows/copilot-setup-steps.yml',
      '.github/prompts', '.github/agents', '.github/skills', '.github/mcp.json',
    ],
  },
};

describe('agent registry', () => {
  it('preserves the baseline identifiers, aliases, and local/global targets', () => {
    const actual = listAgents();
    expect(actual.map((agent) => agent.id)).toEqual(baseline.agents.map((agent) => agent.id).sort());
    expect(AGENT_ALIASES).toEqual(baseline.aliases);
    for (const expected of baseline.agents) {
      const agent = actual.find((candidate) => candidate.id === expected.id)!;
      expect(agent.skillsDir).toBe(expected.skillsDir);
      expect(agent.globalSkillsDir).toBe(expected.globalSkillsDir);
      expect(agent.detectionPaths).toEqual(baselineCorrections[expected.id]?.detectionPaths ?? expected.detectionPaths);
      expect(agent.legacySkillsDirs).toEqual(expected.legacySkillsDirs);
      expect(agent.requiresIdeRestart).toBe(expected.requiresIdeRestart);
    }
  });

  it('lists deterministically and resolves aliases before dispatch', () => {
    expect(listAgents().map((agent) => agent.id)).toEqual([...listAgents().map((agent) => agent.id)].sort());
    expect(resolveAgentId('windsurf')).toBe('devin');
    expect(resolveAgents(['windsurf', 'devin']).map((agent) => agent.id)).toEqual(['devin']);
  });

  it('rejects every unknown selection before configuration can start', () => {
    expect(() => resolveAgents(['codex', 'unknown-agent'])).toThrow('Unknown agent: unknown-agent');
  });
});
