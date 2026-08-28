import { listTools } from '../core/tools/registry.js';

export async function promptForTools(): Promise<string[]> {
  const { checkbox } = await import('@inquirer/prompts');
  return checkbox({
    message: 'Select tools to install (space to toggle, enter to confirm)',
    choices: listTools().map((tool) => ({
      name: `${tool.name} (${tool.id}) — ${tool.description}`,
      value: tool.id,
    })),
    pageSize: 10,
    loop: false,
  });
}

/**
 * Resolve the tool selection. Unlike agents, an empty selection is valid:
 * `mio init` still configures the chosen agents without extra tooling.
 */
export async function selectToolIds(
  supplied: string | undefined,
  interactive: boolean,
  prompt: () => Promise<string[]> = promptForTools
): Promise<string[]> {
  if (supplied !== undefined) {
    const ids = supplied.split(',').map((id) => id.trim()).filter(Boolean);
    return ids.filter((id) => id.toLowerCase() !== 'none');
  }
  if (!interactive) return [];
  return prompt();
}
