import path from 'node:path';
import { Command } from 'commander';
import { resolveAgents } from '../core/agents/registry.js';
import { installInstructions } from '../core/instructions/install.js';
import { listInstructions } from '../core/instructions/registry.js';
import { selectInstructionIds } from '../prompts/select-instructions.js';
import { selectAgentIds } from '../prompts/select-agents.js';
import { isInteractive } from '../utils/interactive.js';

export function registerInstructionsCommand(program: Command): void {
  const instructions = program.command('instructions').description('List and install always-on agent instructions');

  instructions.command('list').description('List bundled instruction documents').option('--json', 'Print JSON')
    .action((options: { json?: boolean }) => {
      const entries = listInstructions();
      if (options.json) {
        console.log(JSON.stringify({ instructions: entries }, null, 2));
        return;
      }
      for (const entry of entries) {
        console.log(`${entry.id}\t${entry.name}${entry.isDefault ? ' (default)' : ''}\t${entry.description}`);
      }
    });

  instructions.command('install [path]').description('Merge instruction documents into the files agents always load')
    .option('--agents <ids>', 'Comma-separated agent identifiers')
    .option('--instructions <ids>', 'Comma-separated instruction identifiers; defaults to every default document')
    .option('--global', 'Write to the agent instruction file in your home instead of the project')
    .action(async (target = '.', options: { agents?: string; instructions?: string; global?: boolean }) => {
      const selectedAgents = await selectAgentIds(options.agents, isInteractive());
      if (selectedAgents.length === 0) throw new Error('Select at least one agent to configure');
      const instructionIds = selectInstructionIds(options.instructions);
      if (instructionIds.length === 0) throw new Error('Select at least one instruction document to install');

      const agents = resolveAgents(selectedAgents);
      const results = await installInstructions({
        projectRoot: path.resolve(target),
        agents,
        instructionIds,
        global: options.global,
      });

      if (results.length === 0) {
        console.log('No selected agent declares a global instruction file');
        return;
      }
      for (const result of results) {
        console.log(`${result.changed ? 'Wrote' : 'Already up to date'} ${result.instruction.id} for ${result.agent.id}: ${result.path}`);
      }
    });
}
