import path from 'node:path';
import { Command } from 'commander';
import { configureAgents } from '../core/agents/configure.js';
import { AGENT_ALIASES, listAgents } from '../core/agents/registry.js';
import { selectAgentIds } from '../prompts/select-agents.js';
import { isInteractive } from '../utils/interactive.js';

export function registerAgentCommand(program: Command): void {
  const agent = program.command('agent').description('List and configure local agent extensions');
  agent.command('list').description('List supported agents in deterministic order').option('--json', 'Print JSON').action((options: { json?: boolean }) => {
    const entries = listAgents();
    if (options.json) {
      console.log(JSON.stringify({ agents: entries, aliases: AGENT_ALIASES }, null, 2));
      return;
    }
    for (const entry of entries) console.log(`${entry.id}\t${entry.name}`);
  });

  agent.command('configure [path]').description('Generate neutral local extension fixtures')
    .option('--agents <ids>', 'Comma-separated agent identifiers')
    .option('--global', 'Use the agent global configuration root when supported')
    .action(async (target = '.', options: { agents?: string; global?: boolean }) => {
      const selected = await selectAgentIds(options.agents, isInteractive());
      if (selected.length === 0) throw new Error('Select at least one agent to configure');
      const results = await configureAgents({ projectRoot: path.resolve(target), agentIds: selected, global: options.global });
      for (const result of results) console.log(`${result.changed ? 'Configured' : 'Already configured'} ${result.agent.id}: ${result.path}`);
    });
}
