import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkillForAgents, installSkills, resolveSkillPath } from '../../../src/core/skills/install.js';
import { resolveAgents } from '../../../src/core/agents/registry.js';
import { CODEGRAPH_SKILL_NAME } from '../../../src/core/tools/codegraph.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-skill-test-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('installSkillForAgents', () => {
  it('copies the whole bundle, references included', async () => {
    const [installed] = await installSkillForAgents(CODEGRAPH_SKILL_NAME, resolveAgents(['claude']), root);
    expect(installed.changed).toBe(true);
    expect(installed.path).toBe(path.join(root, '.claude', 'skills', 'codegraph'));
    expect(readFileSync(path.join(installed.path, 'SKILL.md'), 'utf8')).toContain('name: codegraph');
    expect(existsSync(path.join(installed.path, 'references', 'codegraph-tool-contract.md'))).toBe(true);
    expect(existsSync(path.join(installed.path, 'README.md'))).toBe(true);
  });

  it('writes agents sharing a skills directory only once', async () => {
    const installed = await installSkillForAgents(CODEGRAPH_SKILL_NAME, resolveAgents(['codex', 'zed', 'agents']), root);
    expect(installed).toHaveLength(1);
    expect(installed[0].path).toBe(path.join(root, '.agents', 'skills', 'codegraph'));
  });

  it('is idempotent on a second run', async () => {
    await installSkillForAgents(CODEGRAPH_SKILL_NAME, resolveAgents(['claude']), root);
    const [second] = await installSkillForAgents(CODEGRAPH_SKILL_NAME, resolveAgents(['claude']), root);
    expect(second.changed).toBe(false);
  });

  it('skips agents with no local skills directory', async () => {
    expect(await installSkillForAgents(CODEGRAPH_SKILL_NAME, resolveAgents(['minimax-code']), root)).toEqual([]);
  });

  it('refuses a destination outside the project root', () => {
    const [agent] = resolveAgents(['claude']);
    expect(() => resolveSkillPath({ ...agent, skillsDir: '../escape' }, root, 'codegraph')).toThrow(/outside the allowed target root/);
  });
});

describe('installSkills', () => {
  it('installs the bundle and the command of every requested skill', async () => {
    const [result] = await installSkills({ projectRoot: root, agents: resolveAgents(['claude']), skillIds: ['agents-create'] });
    expect(result.skill.id).toBe('agents-create');
    expect(readFileSync(path.join(result.skills[0].path, 'SKILL.md'), 'utf8')).toContain('name: agents-create');
    expect(existsSync(path.join(result.skills[0].path, 'scripts', 'agents-md.sh'))).toBe(true);
    expect(result.commands[0].invocation).toBe('/mio:agents-create');
    expect(existsSync(result.commands[0].path)).toBe(true);
  });

  // `npm pack` strips the executable bit, so the installer must set it rather
  // than copy it from the bundled asset.
  it('installs shell scripts executable, and repairs a copy whose mode was lost', async () => {
    const [first] = await installSkills({ projectRoot: root, agents: resolveAgents(['claude']), skillIds: ['agents-create'] });
    const script = path.join(first.skills[0].path, 'scripts', 'agents-md.sh');
    expect(statSync(script).mode & 0o111).not.toBe(0);

    chmodSync(script, 0o644);
    const [second] = await installSkills({ projectRoot: root, agents: resolveAgents(['claude']), skillIds: ['agents-create'] });
    expect(second.skills[0].changed).toBe(true);
    expect(statSync(script).mode & 0o111).not.toBe(0);
  });

  it('rejects an unknown skill before writing anything', async () => {
    await expect(installSkills({ projectRoot: root, agents: resolveAgents(['claude']), skillIds: ['nope'] }))
      .rejects.toThrow(/Unknown skill: nope/);
    expect(existsSync(path.join(root, '.claude'))).toBe(false);
  });
});
