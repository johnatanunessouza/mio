import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheDirectoryFor,
  checkoutSkillRepository,
  isLocalSource,
  resolveLocalSource,
  skillRepoCacheRoot,
} from '../../../src/core/skill-repo/source.js';
import type { SkillRepositoryDefinition } from '../../../src/core/skill-repo/types.js';

let repo: string;
let home: string;

function git(...args: string[]): void {
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo, stdio: 'ignore' });
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'mio-source-repo-'));
  home = mkdtempSync(path.join(tmpdir(), 'mio-source-home-'));
  const skill = path.join(repo, 'skills', 'utils', 'debugging');
  mkdirSync(skill, { recursive: true });
  writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: debugging\n---\n', 'utf8');
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const definition = (source: string): SkillRepositoryDefinition => ({ id: 'test', name: 'test', source, skillsDir: 'skills' });

describe('isLocalSource', () => {
  it.each(['/abs/path', './rel', '../rel', '~/repo', 'plain-name'])('treats %s as local', (source) => {
    expect(isLocalSource(source)).toBe(true);
  });

  it.each(['https://host/org/repo.git', 'file:///tmp/repo', 'ssh://host/repo', 'git@host:org/repo.git'])(
    'treats %s as remote',
    (source) => { expect(isLocalSource(source)).toBe(false); }
  );
});

describe('cacheDirectoryFor', () => {
  it('lives under the home cache root and stays stable per source', () => {
    const first = cacheDirectoryFor(definition('https://host/org/skills.git'), home);
    expect(first.startsWith(skillRepoCacheRoot(home))).toBe(true);
    expect(cacheDirectoryFor(definition('https://host/org/skills.git'), home)).toBe(first);
  });

  it('separates two sources that share a readable slug', () => {
    const left = cacheDirectoryFor(definition('https://one.invalid/org/skills.git'), home);
    const right = cacheDirectoryFor(definition('https://two.invalid/org/skills.git'), home);
    expect(left).not.toBe(right);
  });

  it('separates two refs of the same remote', () => {
    const main = cacheDirectoryFor({ ...definition('https://host/org/skills.git'), ref: 'main' }, home);
    const next = cacheDirectoryFor({ ...definition('https://host/org/skills.git'), ref: 'next' }, home);
    expect(main).not.toBe(next);
  });
});

describe('checkoutSkillRepository', () => {
  it('reads a local source in place, without cloning', async () => {
    const checkout = await checkoutSkillRepository(definition(repo), { home });
    expect(checkout.origin).toBe('local');
    expect(checkout.root).toBe(repo);
    expect(checkout.skillsRoot).toBe(path.join(repo, 'skills'));
  });

  it('resolves a relative local source against the working directory', async () => {
    const checkout = await checkoutSkillRepository(definition(path.basename(repo)), { cwd: path.dirname(repo), home });
    expect(resolveLocalSource(path.basename(repo), path.dirname(repo))).toBe(checkout.root);
  });

  it('reports a missing local source by path', async () => {
    await expect(checkoutSkillRepository(definition('/nope/missing'), { home })).rejects.toThrow(/repository not found: \/nope\/missing/);
  });

  it('reports a repository without the skills directory', async () => {
    await expect(checkoutSkillRepository({ ...definition(repo), skillsDir: 'catalog' }, { home }))
      .rejects.toThrow(/has no "catalog" directory/);
  });

  it('clones a remote into the cache and refreshes it on the next run', async () => {
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'skills');

    const remote = definition(`file://${repo}`);
    const first = await checkoutSkillRepository(remote, { home });
    expect(first.origin).toBe('clone');
    expect(first.root).toBe(cacheDirectoryFor(remote, home));

    const added = path.join(repo, 'skills', 'frontend', 'design');
    mkdirSync(added, { recursive: true });
    writeFileSync(path.join(added, 'SKILL.md'), '---\nname: design\n---\n', 'utf8');
    git('add', '-A');
    git('commit', '-qm', 'more skills');

    const second = await checkoutSkillRepository(remote, { home });
    expect(second.root).toBe(first.root);
    const { readSkillCatalog } = await import('../../../src/core/skill-repo/catalog.js');
    expect((await readSkillCatalog(second)).map((category) => category.id)).toEqual(['frontend', 'utils']);
  });

  it('refuses --offline when nothing is cached yet', async () => {
    await expect(checkoutSkillRepository(definition('https://host/org/skills.git'), { home, offline: true }))
      .rejects.toThrow(/No cached checkout/);
  });
});
