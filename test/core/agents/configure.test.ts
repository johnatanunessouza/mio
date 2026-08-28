import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { configureAgents } from '../../../src/core/agents/configure.js';
import { resolveAgentOutputPath } from '../../../src/core/agents/paths.js';
import type { AgentDefinition } from '../../../src/core/agents/types.js';
import { selectAgentIds } from '../../../src/prompts/select-agents.js';

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'mio-agent-test-'));
  temporaryRoots.push(root);
  return root;
}

describe('agent configuration', () => {
  it('generates local content deterministically and idempotently', async () => {
    const root = await temporaryRoot();
    const first = await configureAgents({ projectRoot: root, agentIds: ['codex'] });
    const second = await configureAgents({ projectRoot: root, agentIds: ['codex'] });
    expect(first[0].changed).toBe(true);
    expect(second[0].changed).toBe(false);
    await expect(readFile(first[0].path, 'utf8')).resolves.toContain('no remote installation');
  });

  it('validates all agents before writing a partial result', async () => {
    const root = await temporaryRoot();
    await expect(configureAgents({ projectRoot: root, agentIds: ['codex', 'not-real'] })).rejects.toThrow('Unknown agent');
    await expect(readFile(path.join(root, '.agents', 'skills', 'mio-skeleton.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('supports declared global targets only', async () => {
    const root = await temporaryRoot();
    const result = await configureAgents({ projectRoot: root, agentIds: ['minimax-code'], global: true, globalHome: root });
    expect(result[0].path).toBe(path.join(root, '.minimax', 'skills', 'mio-skeleton.md'));
    await expect(configureAgents({ projectRoot: root, agentIds: ['codex'], global: true })).rejects.toThrow('does not support global');
  });

  it('confines generated paths to their declared root', () => {
    const unsafe: AgentDefinition = { id: 'unsafe', name: 'Unsafe', available: true, skillsDir: '../outside' };
    expect(() => resolveAgentOutputPath(unsafe, '/tmp/mio-safe-root', false)).toThrow('outside the allowed target root');
  });

  it('supports supplied selections and injected interactive selections', async () => {
    await expect(selectAgentIds('codex, windsurf', false)).resolves.toEqual(['codex', 'windsurf']);
    await expect(selectAgentIds(undefined, false)).rejects.toThrow('Use --agents');
    await expect(selectAgentIds(undefined, true, async () => ['claude'])).resolves.toEqual(['claude']);
  });
});
