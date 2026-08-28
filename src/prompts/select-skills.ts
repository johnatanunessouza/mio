import { listDefaultSkills } from '../core/skills/registry.js';

/**
 * Resolve the skill selection. Unlike tools, skills are not prompted for:
 * `mio init` installs every default skill, and `--skills` narrows that (or
 * opts out entirely with "none").
 */
export function selectSkillIds(supplied: string | undefined): string[] {
  if (supplied === undefined) return listDefaultSkills().map((skill) => skill.id);
  const ids = supplied.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.some((id) => id.toLowerCase() === 'none')) return [];
  if (ids.some((id) => id.toLowerCase() === 'all')) return listDefaultSkills().map((skill) => skill.id);
  return ids;
}
