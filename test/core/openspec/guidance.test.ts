import { describe, expect, it } from 'vitest';
import {
  OPENSPEC_GUIDANCE_CATALOG,
  guidanceForSkills,
  guidanceSkillIds,
  renderGuidance,
  yamlScalar,
} from '../../../src/core/openspec/guidance.js';

describe('OPENSPEC_GUIDANCE_CATALOG', () => {
  it('ties the archive guidance to the code-review skill', () => {
    const entry = OPENSPEC_GUIDANCE_CATALOG.find((candidate) => candidate.skillId === 'code-review');
    expect(entry?.section).toBe('archive');
    expect(entry?.lines[0]).toContain('Antes de arquivar');
    expect(entry?.lines[0]).toContain('code-review');
  });

  it('lists every contributing skill once', () => {
    expect(guidanceSkillIds()).toEqual([...new Set(guidanceSkillIds())]);
    expect(guidanceSkillIds()).toContain('code-review');
  });
});

describe('guidanceForSkills', () => {
  it('selects catalog entries by skill id, case-insensitively', () => {
    expect(guidanceForSkills(['CODE-REVIEW']).map((entry) => entry.section)).toEqual(['archive']);
  });

  it('ignores skills that contribute nothing', () => {
    expect(guidanceForSkills(['codegraph', ''])).toEqual([]);
  });
});

describe('yamlScalar', () => {
  it('leaves ordinary prose plain', () => {
    expect(yamlScalar('Antes de arquivar, rodar a skill code-review')).toBe('Antes de arquivar, rodar a skill code-review');
  });

  it('quotes anything YAML would reparse as structure', () => {
    expect(yamlScalar('- not a list item')).toBe("'- not a list item'");
    expect(yamlScalar('key: value')).toBe("'key: value'");
    expect(yamlScalar('trailing:')).toBe("'trailing:'");
    expect(yamlScalar('text # comment')).toBe("'text # comment'");
  });

  it('quotes scalars YAML would read as a non-string', () => {
    expect(yamlScalar('true')).toBe("'true'");
    expect(yamlScalar('no')).toBe("'no'");
    expect(yamlScalar('42')).toBe("'42'");
  });

  it("doubles the only escape single-quoted YAML has", () => {
    expect(yamlScalar("don't: really")).toBe("'don''t: really'");
  });
});

describe('renderGuidance', () => {
  it('emits one guidance list per section', () => {
    const rendered = renderGuidance([
      { skillId: 'a', section: 'archive', lines: ['first'] },
      { skillId: 'b', section: 'apply', lines: ['second'] },
    ]);
    expect(rendered).toBe('archive:\n  guidance:\n    - first\napply:\n  guidance:\n    - second');
  });

  it('merges several skills into the same section', () => {
    const rendered = renderGuidance([
      { skillId: 'a', section: 'archive', lines: ['first'] },
      { skillId: 'b', section: 'archive', lines: ['second'] },
    ]);
    expect(rendered).toBe('archive:\n  guidance:\n    - first\n    - second');
  });

  it('writes a line contributed twice only once', () => {
    const rendered = renderGuidance([
      { skillId: 'a', section: 'archive', lines: ['same'] },
      { skillId: 'b', section: 'archive', lines: ['same'] },
    ]);
    expect(rendered).toBe('archive:\n  guidance:\n    - same');
  });

  it('folds a multi-line source string into one scalar', () => {
    expect(renderGuidance([{ skillId: 'a', section: 'archive', lines: ['one\n  two   three'] }]))
      .toBe('archive:\n  guidance:\n    - one two three');
  });

  it('renders the catalog entry as valid, readable YAML', () => {
    const rendered = renderGuidance(guidanceForSkills(['code-review']));
    expect(rendered.split('\n')).toHaveLength(3);
    expect(rendered.startsWith('archive:\n  guidance:\n    - Antes de arquivar,')).toBe(true);
  });
});
