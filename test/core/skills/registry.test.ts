import { describe, expect, it } from 'vitest';
import { MIO_COMMAND_NAMESPACE, listDefaultSkills, listSkills, resolveSkills, SKILL_CATALOG } from '../../../src/core/skills/registry.js';

describe('skill registry', () => {
  it('ships agents-create as a default skill with a namespaced command', () => {
    const skill = SKILL_CATALOG.find((entry) => entry.id === 'agents-create');
    expect(skill?.isDefault).toBe(true);
    expect(skill?.commands.map((command) => command.name)).toEqual(['agents-create']);
    expect(MIO_COMMAND_NAMESPACE).toBe('mio');
  });

  it('lists every default skill', () => {
    expect(listDefaultSkills().map((skill) => skill.id)).toEqual(
      listSkills().filter((skill) => skill.isDefault).map((skill) => skill.id)
    );
  });

  it('resolves ids in catalog order without duplicates', () => {
    expect(resolveSkills(['agents-create', 'agents-create']).map((skill) => skill.id)).toEqual(['agents-create']);
  });

  it('rejects an unknown id before anything is installed', () => {
    expect(() => resolveSkills(['agents-create', 'nope'])).toThrow(/Unknown skill: nope/);
  });
});
