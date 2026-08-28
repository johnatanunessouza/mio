import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findCategory,
  parseSkillFrontmatter,
  readSkillCatalog,
  readSkillCategory,
  resolveCategorySkills,
} from '../../../src/core/skill-repo/catalog.js';
import type { SkillRepositoryCheckout } from '../../../src/core/skill-repo/types.js';

let root: string;
let skillsRoot: string;

function writeSkill(category: string, id: string, frontmatter: string): void {
  const target = path.join(skillsRoot, category, id);
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, 'SKILL.md'), `---\n${frontmatter}\n---\n\n# ${id}\n`, 'utf8');
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'mio-repo-test-'));
  skillsRoot = path.join(root, 'skills');
  writeSkill('frontend', 'design-system', 'name: design-system\ndescription: Build a design system');
  writeSkill('utils', 'debugging', 'name: debugging\ndescription: >-\n  Use when a test fails\n  or output is wrong');
  mkdirSync(path.join(skillsRoot, 'backend'), { recursive: true });
  mkdirSync(path.join(skillsRoot, '.hidden'), { recursive: true });
  mkdirSync(path.join(skillsRoot, 'utils', 'not-a-skill'), { recursive: true });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const checkout = (): SkillRepositoryCheckout => ({
  repository: { id: 'test', name: 'test', source: root, skillsDir: 'skills' },
  root,
  skillsRoot,
  origin: 'local',
});

describe('parseSkillFrontmatter', () => {
  it('reads plain scalars', () => {
    expect(parseSkillFrontmatter('---\nname: a\ndescription: b\n---\nbody')).toEqual({ name: 'a', description: 'b' });
  });

  it('folds block scalars onto one line', () => {
    const parsed = parseSkillFrontmatter('---\nname: a\ndescription: >-\n  first line\n  second line\nallowed-tools: Read\n---\n');
    expect(parsed.description).toBe('first line second line');
  });

  it('keeps line breaks in literal block scalars', () => {
    expect(parseSkillFrontmatter('---\ndescription: |\n  one\n  two\n---\n').description).toBe('one\ntwo');
  });

  it('strips surrounding quotes', () => {
    expect(parseSkillFrontmatter('---\nname: "quoted"\n---\n').name).toBe('quoted');
  });

  it('returns nothing when there is no frontmatter', () => {
    expect(parseSkillFrontmatter('# just a heading\n')).toEqual({});
  });
});

describe('readSkillCatalog', () => {
  it('lists categories alphabetically, empty ones included', async () => {
    const categories = await readSkillCatalog(checkout());
    expect(categories.map((category) => category.id)).toEqual(['backend', 'frontend', 'utils']);
    expect(categories[0].skills).toEqual([]);
  });

  it('reads the frontmatter of each skill', async () => {
    const [, frontend] = await readSkillCatalog(checkout());
    expect(frontend.skills).toHaveLength(1);
    expect(frontend.skills[0]).toMatchObject({ id: 'design-system', category: 'frontend', description: 'Build a design system' });
  });

  it('ignores directories without a SKILL.md', async () => {
    const category = await readSkillCategory(skillsRoot, 'utils');
    expect(category.skills.map((skill) => skill.id)).toEqual(['debugging']);
  });
});

describe('findCategory', () => {
  it('matches case-insensitively', async () => {
    const categories = await readSkillCatalog(checkout());
    expect(findCategory(categories, 'FrontEnd').id).toBe('frontend');
  });

  it('lists the available categories when the name is unknown', async () => {
    const categories = await readSkillCatalog(checkout());
    expect(() => findCategory(categories, 'nope')).toThrow(/Available categories: backend, frontend, utils/);
  });
});

describe('resolveCategorySkills', () => {
  it('rejects an unknown skill before anything is written', async () => {
    const category = await readSkillCategory(skillsRoot, 'frontend');
    expect(() => resolveCategorySkills(category, ['design-system', 'ghost'])).toThrow(/Unknown skill in "frontend": ghost/);
  });

  it('preserves listing order regardless of the order requested', async () => {
    writeSkill('frontend', 'alpha', 'name: alpha');
    const category = await readSkillCategory(skillsRoot, 'frontend');
    expect(resolveCategorySkills(category, ['design-system', 'alpha']).map((skill) => skill.id)).toEqual(['alpha', 'design-system']);
  });
});
