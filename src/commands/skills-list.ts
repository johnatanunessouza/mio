import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveAgents } from '../core/agents/registry.js';
import { findCategory, readSkillCatalog, resolveCategorySkills } from '../core/skill-repo/catalog.js';
import { installRepositorySkills } from '../core/skill-repo/install.js';
import { resolveSkillRepository } from '../core/skill-repo/registry.js';
import { checkoutSkillRepository } from '../core/skill-repo/source.js';
import { applyOpenspecGuidance } from '../core/openspec/config.js';
import type { OpenspecGuidanceResult } from '../core/openspec/config.js';
import type { InstalledRepositorySkill, SkillCategory, SkillRepositoryCheckout } from '../core/skill-repo/types.js';
import { selectAgentIds } from '../prompts/select-agents.js';
import { selectCategoryId, selectSkillIds } from '../prompts/select-repo-skills.js';
import { isInteractive } from '../utils/interactive.js';

interface SkillsListOptions {
  repo?: string;
  skillsDir?: string;
  category?: string;
  skills?: string;
  agents?: string;
  json?: boolean;
  offline?: boolean;
}

function printCatalog(checkout: SkillRepositoryCheckout, categories: readonly SkillCategory[]): void {
  console.log(chalk.dim(`\n  ${checkout.repository.source}${checkout.origin === 'clone' ? chalk.dim(` → ${checkout.root}`) : ''}`));
  console.log(chalk.bold('\nskills:'));
  for (const category of categories) {
    const count = category.skills.length === 1 ? '1 skill' : `${category.skills.length} skills`;
    console.log(`  ${chalk.cyan(category.id)} ${chalk.dim(`(${count})`)}`);
  }
  console.log('');
}

function printCategory(category: SkillCategory): void {
  console.log(chalk.bold(`\n${category.id}:`));
  if (category.skills.length === 0) console.log(chalk.dim('  (no skills)'));
  for (const skill of category.skills) {
    console.log(`  ${chalk.cyan(skill.id)}${skill.description ? chalk.dim(` — ${skill.description.replace(/\s+/g, ' ')}`) : ''}`);
  }
  console.log('');
}

function printInstalled(projectRoot: string, installed: readonly InstalledRepositorySkill[]): void {
  console.log(chalk.green.bold('\n✓ Skills installed'));
  console.log(chalk.dim(`  Project: ${projectRoot}`));
  if (installed.length === 0) {
    console.log(chalk.yellow('  No selected agent supports local skills — nothing was written.'));
    console.log('');
    return;
  }
  let current = '';
  for (const entry of installed) {
    if (entry.skill.id !== current) {
      current = entry.skill.id;
      console.log(`\n  ${chalk.cyan(entry.skill.id)} ${chalk.dim(`(${entry.skill.category})`)}`);
    }
    const marker = entry.changed ? chalk.green('✓') : chalk.dim('·');
    const state = entry.changed ? entry.path : `${entry.path} already up to date`;
    console.log(`    ${marker} ${entry.agent.name}${chalk.dim(` — ${state}`)}`);
  }
  console.log('');
}

/**
 * Report what the installed skills contributed to `openspec/config.yaml`.
 * Silent when nothing was contributed, so the common case — skills that carry
 * no OpenSpec guidance — leaves the install output unchanged.
 */
function printOpenspecGuidance(result: OpenspecGuidanceResult): void {
  if (result.reason === 'no-guidance') return;
  console.log(chalk.bold('  OpenSpec'));
  if (result.reason === 'no-openspec-project') {
    console.log(chalk.dim(`    · ${result.skillIds.join(', ')} guidance pending — run \`mio init --tools openspec\` to create openspec/`));
    console.log('');
    return;
  }
  const marker = result.changed ? chalk.green('✓') : chalk.dim('·');
  const state = result.changed ? `${result.sections.join(', ')} guidance written` : 'guidance already up to date';
  console.log(`    ${marker} ${state}${chalk.dim(` — ${result.path} (from: ${result.skillIds.join(', ')})`)}`);
  console.log('');
}

export function registerSkillsListCommand(program: Command): void {
  program
    .command('skills-list [path]')
    .description('Browse a skills repository by category and install the selected skills into agents')
    .option('--repo <url|path>', 'Repository to read; defaults to the configured one or MIO_SKILLS_REPO')
    .option('--skills-dir <dir>', 'Directory holding the categories inside the repository (default: skills)')
    .option('--category <name>', 'Category to install from, skipping the first menu')
    .option('--skills <names>', 'Comma-separated skill names within the category, or "all"')
    .option('--agents <ids>', 'Comma-separated agent identifiers')
    .option('--json', 'Print the catalog as JSON without installing')
    .option('--offline', 'Use the cached clone without contacting the remote')
    .action(async (target = '.', options: SkillsListOptions) => {
      const interactive = isInteractive();
      const repository = resolveSkillRepository({ supplied: options.repo, skillsDir: options.skillsDir });
      const checkout = await checkoutSkillRepository(repository, { offline: options.offline });
      const categories = await readSkillCatalog(checkout);

      if (options.json) {
        console.log(JSON.stringify({ repository, root: checkout.root, categories }, null, 2));
        return;
      }

      // With no category and no terminal to prompt in, the command does what
      // its name says and lists what the repository offers.
      if (!options.category && !interactive) {
        printCatalog(checkout, categories);
        return;
      }

      if (!options.category) printCatalog(checkout, categories);
      const category = findCategory(categories, await selectCategoryId(options.category, categories, interactive));

      // A named category with no skill selection lists that category instead of
      // erroring, so `--category x` alone is a drill-down rather than a failure.
      if (options.category && options.skills === undefined && !interactive) {
        printCategory(category);
        return;
      }

      const skillIds = await selectSkillIds(options.skills, category, interactive);
      const skills = resolveCategorySkills(category, skillIds);
      if (skills.length === 0) throw new Error('Select at least one skill to install');

      const selectedAgents = await selectAgentIds(options.agents, interactive);
      if (selectedAgents.length === 0) throw new Error('Select at least one agent to configure');

      const projectRoot = path.resolve(target);
      const installed = await installRepositorySkills({
        projectRoot,
        agents: resolveAgents(selectedAgents),
        skills,
      });
      printInstalled(projectRoot, installed);

      // A skill can carry rules for how an OpenSpec workflow must be run;
      // installing it is what puts them in the project's config.yaml.
      printOpenspecGuidance(await applyOpenspecGuidance({
        projectRoot,
        skillIds: skills.map((skill) => skill.id),
      }));
    });
}
