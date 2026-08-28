import type { RepositorySkill, SkillCategory } from '../core/skill-repo/types.js';

function truncate(text: string, limit = 92): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > limit ? `${single.slice(0, limit - 1)}…` : single;
}

/** First menu: the category folders found in the repository skills directory. */
export async function promptForCategory(categories: readonly SkillCategory[]): Promise<string> {
  const { select } = await import('@inquirer/prompts');
  return select({
    message: 'Select a skills category',
    choices: categories.map((category) => ({
      name: `${category.id} ${category.skills.length === 1 ? '(1 skill)' : `(${category.skills.length} skills)`}`,
      value: category.id,
      disabled: category.skills.length === 0 ? '(empty)' : false,
    })),
    pageSize: 15,
    loop: false,
  });
}

/** Second menu: the skills inside the chosen category, space to toggle. */
export async function promptForCategorySkills(category: SkillCategory): Promise<string[]> {
  const { checkbox } = await import('@inquirer/prompts');
  return checkbox({
    message: `Select skills from "${category.id}" (space to toggle, enter to confirm)`,
    choices: category.skills.map((skill) => ({
      name: skill.description ? `${skill.id} — ${truncate(skill.description)}` : skill.id,
      value: skill.id,
    })),
    pageSize: 15,
    loop: false,
    validate: (selected) => selected.length > 0 || 'Select at least one skill',
  });
}

export async function selectCategoryId(
  supplied: string | undefined,
  categories: readonly SkillCategory[],
  interactive: boolean,
  prompt: (categories: readonly SkillCategory[]) => Promise<string> = promptForCategory
): Promise<string> {
  if (supplied) return supplied;
  if (!interactive) throw new Error('Use --category in a non-interactive terminal');
  if (categories.every((category) => category.skills.length === 0)) {
    throw new Error('The repository has no category containing skills');
  }
  return prompt(categories);
}

export async function selectSkillIds(
  supplied: string | undefined,
  category: SkillCategory,
  interactive: boolean,
  prompt: (category: SkillCategory) => Promise<string[]> = promptForCategorySkills
): Promise<string[]> {
  if (supplied !== undefined) {
    const ids = supplied.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.some((id) => id.toLowerCase() === 'all')) return category.skills.map((skill: RepositorySkill) => skill.id);
    return ids;
  }
  if (!interactive) throw new Error('Use --skills in a non-interactive terminal');
  if (category.skills.length === 0) throw new Error(`Category "${category.id}" has no skills`);
  return prompt(category);
}
