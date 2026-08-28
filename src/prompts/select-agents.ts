import { listAgents } from '../core/agents/registry.js';

export async function promptForAgents(): Promise<string[]> {
  const { checkbox } = await import('@inquirer/prompts');
  return checkbox({
    message: 'Select agents to configure',
    choices: listAgents().map((agent) => ({ name: `${agent.name} (${agent.id})`, value: agent.id })),
    pageSize: 15,
    loop: false,
    validate: (selected) => selected.length > 0 || 'Select at least one agent',
  });
}

export async function selectAgentIds(
  supplied: string | undefined,
  interactive: boolean,
  prompt: () => Promise<string[]> = promptForAgents
): Promise<string[]> {
  if (supplied) return supplied.split(',').map((id) => id.trim()).filter(Boolean);
  if (!interactive) throw new Error('Use --agents in a non-interactive terminal');
  return prompt();
}
