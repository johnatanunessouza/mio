import type { SkillDefinition } from './types.js';

/** Namespace every mio command lives under: `/mio:<name>`. */
export const MIO_COMMAND_NAMESPACE = 'mio';

/** Skills mio bundles and installs into the selected agents, in menu order. */
export const SKILL_CATALOG: readonly SkillDefinition[] = [
  {
    id: 'agents-create',
    name: 'Create AGENTS.md',
    description: 'Generate and refresh AGENTS.md across a repository, in any language',
    isDefault: true,
    commands: [
      {
        name: 'agents-create',
        title: 'mio: Create AGENTS.md',
        description: 'Create or refresh the AGENTS.md files of this project (root, one node, or all nodes)',
        body: 'agents-create.md',
      },
    ],
  },
];

export function listSkills(): SkillDefinition[] {
  return [...SKILL_CATALOG];
}

export function listDefaultSkills(): SkillDefinition[] {
  return SKILL_CATALOG.filter((skill) => skill.isDefault);
}

/**
 * Resolve requested skill ids, preserving catalog order and dropping
 * duplicates. Every id is validated before anything is written.
 */
export function resolveSkills(ids: readonly string[]): SkillDefinition[] {
  const requested = ids.map((id) => id.trim().toLowerCase()).filter(Boolean);
  const unknown = requested.filter((id) => !SKILL_CATALOG.some((skill) => skill.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown skill: ${unknown.join(', ')}. Accepted skills: ${SKILL_CATALOG.map((skill) => skill.id).join(', ')}`);
  }
  return SKILL_CATALOG.filter((skill) => requested.includes(skill.id));
}
