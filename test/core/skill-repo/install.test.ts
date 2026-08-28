import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveAgents } from '../../../src/core/agents/registry.js';
import { readSkillCategory } from '../../../src/core/skill-repo/catalog.js';
import { installRepositorySkills } from '../../../src/core/skill-repo/install.js';
import type { RepositorySkill } from '../../../src/core/skill-repo/types.js';

let repo: string;
let project: string;
let skillsRoot: string;

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'mio-repo-src-'));
  project = mkdtempSync(path.join(tmpdir(), 'mio-repo-dst-'));
  skillsRoot = path.join(repo, 'skills');
  const skill = path.join(skillsRoot, 'utils', 'debugging');
  mkdirSync(path.join(skill, 'references'), { recursive: true });
  writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: debugging\ndescription: Debug things\n---\n', 'utf8');
  writeFileSync(path.join(skill, 'references', 'notes.md'), 'notes\n', 'utf8');
  writeFileSync(path.join(skill, 'run.sh'), '#!/bin/sh\necho hi\n', 'utf8');
  chmodSync(path.join(skill, 'run.sh'), 0o644);
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

const skills = async (): Promise<RepositorySkill[]> => (await readSkillCategory(skillsRoot, 'utils')).skills;

describe('installRepositorySkills', () => {
  it('copies the whole bundle under the agent skills directory', async () => {
    const [installed] = await installRepositorySkills({
      projectRoot: project,
      agents: resolveAgents(['claude']),
      skills: await skills(),
    });
    expect(installed.changed).toBe(true);
    expect(installed.path).toBe(path.join(project, '.claude', 'skills', 'debugging'));
    expect(readFileSync(path.join(installed.path, 'SKILL.md'), 'utf8')).toContain('name: debugging');
    expect(existsSync(path.join(installed.path, 'references', 'notes.md'))).toBe(true);
  });

  it('installs shell scripts executable even when the source lost the bit', async () => {
    const [installed] = await installRepositorySkills({
      projectRoot: project,
      agents: resolveAgents(['claude']),
      skills: await skills(),
    });
    expect(statSync(path.join(installed.path, 'run.sh')).mode & 0o111).not.toBe(0);
  });

  it('writes agents sharing a skills directory only once', async () => {
    const installed = await installRepositorySkills({
      projectRoot: project,
      agents: resolveAgents(['codex', 'zed', 'agents']),
      skills: await skills(),
    });
    expect(installed).toHaveLength(1);
    expect(installed[0].path).toBe(path.join(project, '.agents', 'skills', 'debugging'));
  });

  it('skips agents with no local skills directory', async () => {
    const installed = await installRepositorySkills({
      projectRoot: project,
      agents: resolveAgents(['minimax-code']),
      skills: await skills(),
    });
    expect(installed).toEqual([]);
  });

  it('reports a second run as unchanged', async () => {
    const options = { projectRoot: project, agents: resolveAgents(['claude']), skills: await skills() };
    await installRepositorySkills(options);
    const [second] = await installRepositorySkills(options);
    expect(second.changed).toBe(false);
  });

  it('refuses to write outside the project root', async () => {
    const [agent] = resolveAgents(['claude']);
    await expect(installRepositorySkills({
      projectRoot: project,
      agents: [{ ...agent, skillsDir: '../escape' }],
      skills: await skills(),
    })).rejects.toThrow(/outside the allowed target root/);
  });
});
