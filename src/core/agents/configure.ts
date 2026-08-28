import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveAgents } from './registry.js';
import { resolveAgentOutputPath } from './paths.js';
import type { ConfigureAgentsOptions, GeneratedAgentConfiguration } from './types.js';

function localSkillContent(agentId: string): string {
  return `# mio local extension\n\nThis neutral local fixture is managed by mio for ${agentId}.\nIt contains no workflow instructions and performs no remote installation.\n`;
}

/** Configure every requested agent only after the complete selection validates. */
export async function configureAgents(options: ConfigureAgentsOptions): Promise<GeneratedAgentConfiguration[]> {
  const agents = resolveAgents(options.agentIds);
  const outputs = agents.map((agent) => ({
    agent,
    path: resolveAgentOutputPath(agent, options.projectRoot, Boolean(options.global), options.globalHome),
  }));
  const results: GeneratedAgentConfiguration[] = [];

  for (const output of outputs) {
    const content = localSkillContent(output.agent.id);
    let existing: string | undefined;
    try {
      existing = await readFile(output.path, 'utf8');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (existing !== content) {
      await mkdir(path.dirname(output.path), { recursive: true });
      await writeFile(output.path, content, 'utf8');
    }
    results.push({ ...output, changed: existing !== content });
  }
  return results;
}
