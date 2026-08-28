import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SKILLS_DIR,
  DEFAULT_SKILLS_REPO_SOURCE,
  defaultSkillRepository,
  listSkillRepositories,
  resolveSkillRepository,
} from '../../../src/core/skill-repo/registry.js';

describe('resolveSkillRepository', () => {
  it('takes --repo as a source when it is not a catalog id', () => {
    const repository = resolveSkillRepository({ supplied: '../git-test', env: {} });
    expect(repository).toMatchObject({ id: 'custom', source: '../git-test', skillsDir: DEFAULT_SKILLS_DIR });
  });

  it('selects a catalog entry by id rather than treating it as a source', () => {
    const repository = resolveSkillRepository({ supplied: 'mio-brain', env: { MIO_SKILLS_REPO: 'https://other.invalid/x.git' } });
    expect(repository).toMatchObject({ id: 'mio-brain', source: DEFAULT_SKILLS_REPO_SOURCE });
  });

  it('falls back to MIO_SKILLS_REPO when nothing is supplied', () => {
    expect(resolveSkillRepository({ env: { MIO_SKILLS_REPO: 'git@host:org/skills.git' } }).source).toBe('git@host:org/skills.git');
  });

  it('prefers --repo over the environment', () => {
    const repository = resolveSkillRepository({ supplied: '/local/repo', env: { MIO_SKILLS_REPO: 'https://other.invalid/x.git' } });
    expect(repository.source).toBe('/local/repo');
  });

  it('overrides the skills directory', () => {
    expect(resolveSkillRepository({ supplied: '/local/repo', skillsDir: 'catalog', env: {} }).skillsDir).toBe('catalog');
  });

  it('falls back to the configured repository when nothing is supplied', () => {
    expect(defaultSkillRepository().source).toBe(DEFAULT_SKILLS_REPO_SOURCE);
    expect(resolveSkillRepository({ env: {} })).toMatchObject({ id: 'mio-brain', skillsDir: DEFAULT_SKILLS_DIR });
  });

  it('reads over HTTPS so a clone needs no SSH key', () => {
    expect(DEFAULT_SKILLS_REPO_SOURCE.startsWith('https://')).toBe(true);
  });

  it('exposes the catalog as a copy', () => {
    expect(listSkillRepositories()).not.toBe(listSkillRepositories());
  });
});
