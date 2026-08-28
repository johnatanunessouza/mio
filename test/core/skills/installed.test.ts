import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { filterInstalledSkills, isSkillInstalled } from '../../../src/core/skills/installed.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-installed-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('isSkillInstalled', () => {
  it('is false in an empty project', async () => {
    expect(await isSkillInstalled(root, 'code-review')).toBe(false);
  });

  it('finds a bundle in any agent skills directory', async () => {
    mkdirSync(path.join(root, '.codex', 'skills', 'code-review'), { recursive: true });
    expect(await isSkillInstalled(root, 'code-review')).toBe(true);
  });

  it('ignores a file where the bundle directory should be', async () => {
    mkdirSync(path.join(root, '.claude', 'skills'), { recursive: true });
    writeFileSync(path.join(root, '.claude', 'skills', 'code-review'), '', 'utf8');
    expect(await isSkillInstalled(root, 'code-review')).toBe(false);
  });
});

describe('filterInstalledSkills', () => {
  it('keeps the installed ids in the order given', async () => {
    mkdirSync(path.join(root, '.claude', 'skills', 'code-review'), { recursive: true });
    expect(await filterInstalledSkills(root, ['codegraph', 'code-review'])).toEqual(['code-review']);
  });
});
