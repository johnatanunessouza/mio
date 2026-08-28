import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveAgents } from '../core/agents/registry.js';
import { installSkills } from '../core/skills/install.js';
import { listSkills, MIO_COMMAND_NAMESPACE } from '../core/skills/registry.js';
import { selectSkillIds } from '../prompts/select-skills.js';
import { selectAgentIds } from '../prompts/select-agents.js';
import { isInteractive } from '../utils/interactive.js';

export function registerSkillCommand(program: Command): void {
  const skill = program.command('skill').description('List and install the skills mio bundles');

  skill.command('list').description('List bundled skills in catalog order').option('--json', 'Print JSON')
    .action((options: { json?: boolean }) => {
      const entries = listSkills();
      if (options.json) {
        console.log(JSON.stringify({ namespace: MIO_COMMAND_NAMESPACE, skills: entries }, null, 2));
        return;
      }
      for (const entry of entries) {
        const commands = entry.commands.map((command) => `/${MIO_COMMAND_NAMESPACE}:${command.name}`).join(', ');
        console.log(`${entry.id}\t${entry.name}${entry.isDefault ? ' (default)' : ''}\t${commands}`);
      }
    });

  skill.command('install [path]').description('Install bundled skills and their commands into agents')
    .option('--agents <ids>', 'Comma-separated agent identifiers')
    .option('--skills <ids>', 'Comma-separated skill identifiers; defaults to every default skill')
    .action(async (target = '.', options: { agents?: string; skills?: string }) => {
      const selectedAgents = await selectAgentIds(options.agents, isInteractive());
      if (selectedAgents.length === 0) throw new Error('Select at least one agent to configure');
      const skillIds = selectSkillIds(options.skills);
      if (skillIds.length === 0) throw new Error('Select at least one skill to install');

      const results = await installSkills({
        projectRoot: path.resolve(target),
        agents: resolveAgents(selectedAgents),
        skillIds,
      });
      for (const result of results) {
        for (const entry of result.skills) {
          console.log(`${entry.changed ? 'Installed' : 'Already installed'} ${result.skill.id} for ${entry.agent.id}: ${entry.path}`);
        }
        for (const entry of result.commands) {
          console.log(`${entry.changed ? 'Installed' : 'Already installed'} ${chalk.cyan(entry.invocation)} for ${entry.agent.id}: ${entry.path}`);
        }
      }
    });
}
