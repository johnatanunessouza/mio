import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { configureAgents } from '../core/agents/configure.js';
import { AGENTS_BLOCK_HEADER, collectAgentDirectories, updateGitignore } from '../core/gitignore.js';
import type { GitignoreUpdate } from '../core/gitignore.js';
import { listAgents, resolveAgents } from '../core/agents/registry.js';
import { installInstructions } from '../core/instructions/install.js';
import { listInstructions } from '../core/instructions/registry.js';
import type { InstalledInstruction } from '../core/instructions/types.js';
import { selectInstructionIds } from '../prompts/select-instructions.js';
import { installSkills } from '../core/skills/install.js';
import { listSkills } from '../core/skills/registry.js';
import type { SkillInstallResult } from '../core/skills/types.js';
import { selectSkillIds } from '../prompts/select-skills.js';
import { installTools } from '../core/tools/install.js';
import { listTools } from '../core/tools/registry.js';
import type { ToolInstallResult, ToolInstallStep } from '../core/tools/types.js';
import { selectAgentIds } from '../prompts/select-agents.js';
import { selectToolIds } from '../prompts/select-tools.js';
import { showWelcomeScreen } from '../ui/welcome-screen.js';
import { isInteractive } from '../utils/interactive.js';

interface InitOptions {
  agents?: string;
  skills?: string;
  instructions?: string;
  tools?: string;
  animation?: boolean;
  dryRun?: boolean;
}

async function resolveProjectRoot(target: string): Promise<string> {
  const projectRoot = path.resolve(target);
  try {
    const details = await stat(projectRoot);
    if (!details.isDirectory()) throw new Error(`Path "${target}" is not a directory`);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(projectRoot, { recursive: true });
  }
  return projectRoot;
}

const STEP_MARKERS: Record<ToolInstallStep['status'], string> = {
  done: chalk.green('✓'),
  skipped: chalk.dim('·'),
  failed: chalk.red('✗'),
};

function printSkills(skillResults: readonly SkillInstallResult[]): void {
  if (skillResults.length === 0) return;
  console.log(chalk.bold('\n  Skills'));
  for (const result of skillResults) {
    console.log(`    ${chalk.cyan(result.skill.name)} ${chalk.dim(`(${result.skill.id})`)}`);
    if (result.skills.length === 0) {
      console.log(`      ${STEP_MARKERS.skipped} no selected agent supports local skills`);
    }
    for (const entry of result.skills) {
      const marker = entry.changed ? STEP_MARKERS.done : STEP_MARKERS.skipped;
      const detail = entry.changed ? entry.path : `${entry.path} already up to date`;
      console.log(`      ${marker} ${entry.agent.name}${chalk.dim(` — ${detail}`)}`);
    }
    // Every agent that resolves to the same command file is listed once, so the
    // user sees exactly which invocation to type where.
    for (const entry of result.commands) {
      const marker = entry.changed ? STEP_MARKERS.done : STEP_MARKERS.skipped;
      console.log(`      ${marker} ${chalk.cyan(entry.invocation)} ${chalk.dim(`(${entry.agent.name}) — ${entry.path}`)}`);
    }
  }
}

function printInstructions(instructionResults: readonly InstalledInstruction[]): void {
  if (instructionResults.length === 0) return;
  console.log(chalk.bold('\n  Instructions'));
  for (const entry of instructionResults) {
    const marker = entry.changed ? STEP_MARKERS.done : STEP_MARKERS.skipped;
    const state = entry.changed ? (entry.merged ? 'merged into' : 'created') : 'already up to date in';
    console.log(`    ${marker} ${chalk.cyan(entry.instruction.name)} ${chalk.dim(`— ${state} ${entry.path} (${entry.agent.name})`)}`);
  }
}

function printSummary(
  projectRoot: string,
  agentResults: Awaited<ReturnType<typeof configureAgents>>,
  skillResults: readonly SkillInstallResult[],
  instructionResults: readonly InstalledInstruction[],
  toolResults: readonly ToolInstallResult[],
  gitignore: GitignoreUpdate
): void {
  console.log(chalk.green.bold('\n✓ mio initialized'));
  console.log(chalk.dim(`  Project: ${projectRoot}`));

  console.log(chalk.bold('\n  Agents'));
  for (const result of agentResults) {
    const status = result.changed ? chalk.green('configured') : chalk.dim('already configured');
    console.log(`    ${chalk.cyan(result.agent.name)} ${status}`);
    console.log(chalk.dim(`      ${result.path}`));
  }

  printSkills(skillResults);
  printInstructions(instructionResults);

  if (toolResults.length > 0) {
    console.log(chalk.bold('\n  Tools'));
    for (const result of toolResults) {
      console.log(`    ${chalk.cyan(result.tool.name)}`);
      for (const step of result.steps) {
        const detail = step.detail ? chalk.dim(` — ${step.detail}`) : '';
        console.log(`      ${STEP_MARKERS[step.status]} ${step.label}${detail}`);
      }
    }
  }

  console.log(chalk.bold('\n  Git'));
  console.log(`    ${gitignore.changed ? STEP_MARKERS.done : STEP_MARKERS.skipped} ${AGENTS_BLOCK_HEADER} in .gitignore${chalk.dim(
    gitignore.changed ? ` — added ${gitignore.added.join(', ')}` : ' — already up to date'
  )}`);
  console.log(chalk.dim(`      ${gitignore.path}`));

  const failures = toolResults.flatMap((result) => result.steps.filter((step) => step.status === 'failed'));
  if (failures.length > 0) {
    console.log(chalk.yellow(`\n  ${failures.length} step(s) failed — see the details above and re-run \`mio init\` after fixing them.`));
  }

  const needsRestart = agentResults.filter((result) => result.agent.requiresIdeRestart);
  if (needsRestart.length > 0) {
    console.log(chalk.dim(`\n  Restart your IDE to pick up: ${needsRestart.map((result) => result.agent.name).join(', ')}`));
  }
  console.log('');
}

export function registerInitCommand(program: Command): void {
  const availableAgents = listAgents().map((agent) => agent.id).join(', ');
  const availableSkills = listSkills().map((skill) => skill.id).join(', ');
  const availableInstructions = listInstructions().map((instruction) => instruction.id).join(', ');
  const availableTools = listTools().map((tool) => tool.id).join(', ');
  program
    .command('init [path]')
    .description('Initialize agent extensions and developer tools in a project')
    .option('--agents <ids>', `Configure agents non-interactively (${availableAgents})`)
    .option('--skills <ids>', `Skills to install (${availableSkills}, or "none"); defaults to every default skill`)
    .option('--instructions <ids>', `Always-on instructions to install (${availableInstructions}, or "none")`)
    .option('--tools <ids>', `Install tools non-interactively (${availableTools}, or "none")`)
    .option('--no-animation', 'Show a static welcome screen')
    .option('--dry-run', 'Report what each tool would do without running installers')
    .action(async (target = '.', options: InitOptions) => {
      const interactive = isInteractive();
      if (!options.agents && interactive) {
        await showWelcomeScreen({ animate: options.animation });
      }

      const selectedAgents = await selectAgentIds(options.agents, interactive);
      if (selectedAgents.length === 0) throw new Error('Select at least one agent to configure');

      const selectedSkills = selectSkillIds(options.skills);
      const selectedInstructions = selectInstructionIds(options.instructions);
      const selectedTools = await selectToolIds(options.tools, interactive);

      const projectRoot = await resolveProjectRoot(target);
      const agentResults = await configureAgents({ projectRoot, agentIds: selectedAgents });

      // Default skills land before the tools so an interrupted tool install
      // still leaves the agents with the skills and commands mio bundles.
      const skillResults = selectedSkills.length === 0 ? [] : await installSkills({
        projectRoot,
        agents: resolveAgents(selectedAgents),
        skillIds: selectedSkills,
      });

      // The instruction documents are agent behaviour rather than project
      // knowledge, so they are merged into the file each agent always loads
      // instead of being generated into every AGENTS.md of the repo.
      const instructionResults = selectedInstructions.length === 0 ? [] : await installInstructions({
        projectRoot,
        agents: resolveAgents(selectedAgents),
        instructionIds: selectedInstructions,
      });

      const toolResults = selectedTools.length === 0 ? [] : await installTools({
        projectRoot,
        agents: resolveAgents(selectedAgents),
        toolIds: selectedTools,
        interactive,
        dryRun: options.dryRun,
      });

      // Runs after every init, whatever tools were selected (including none).
      const gitignore = await updateGitignore(projectRoot, collectAgentDirectories(resolveAgents(selectedAgents)));

      printSummary(projectRoot, agentResults, skillResults, instructionResults, toolResults, gitignore);
    });
}
