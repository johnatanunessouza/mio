import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentDefinition } from '../agents/types.js';
import { commandAssetPath, confinedPath } from './assets.js';
import { MIO_COMMAND_NAMESPACE } from './registry.js';
import type { InstalledCommand, SkillCommandDefinition } from './types.js';

/** Command directory of an agent, defaulting to `<skillsDir>/commands`. */
function commandsDir(agent: AgentDefinition): string | undefined {
  if (agent.commandsDir) return agent.commandsDir;
  return agent.skillsDir ? path.posix.join(agent.skillsDir, 'commands') : undefined;
}

export interface CommandTarget {
  path: string;
  /** How the user types the command in that agent. */
  invocation: string;
}

/**
 * Where one command lands for one agent, and how it is invoked there.
 * Returns undefined for agents with no project-local command directory.
 */
export function resolveCommandTarget(
  agent: AgentDefinition,
  projectRoot: string,
  commandName: string
): CommandTarget | undefined {
  const directory = commandsDir(agent);
  if (!directory) return undefined;
  const extension = agent.commandExtension ?? '.md';
  if ((agent.commandStyle ?? 'namespace-dir') === 'prefixed-file') {
    return {
      path: confinedPath(projectRoot, path.join(directory, `${MIO_COMMAND_NAMESPACE}-${commandName}${extension}`)),
      invocation: `/${MIO_COMMAND_NAMESPACE}-${commandName}`,
    };
  }
  return {
    path: confinedPath(projectRoot, path.join(directory, MIO_COMMAND_NAMESPACE, `${commandName}${extension}`)),
    invocation: `/${MIO_COMMAND_NAMESPACE}:${commandName}`,
  };
}

/**
 * Render the command file. `namespace-dir` agents show a command name, so the
 * namespaced name is carried in the frontmatter; flat command directories
 * derive the name from the filename and only need a description.
 */
export function renderCommand(agent: AgentDefinition, command: SkillCommandDefinition, body: string): string {
  const frontmatter = (agent.commandStyle ?? 'namespace-dir') === 'prefixed-file'
    ? [`description: ${command.description}`]
    : [`name: "${MIO_COMMAND_NAMESPACE}:${command.name}"`, `description: ${command.description}`];
  return `---\n${frontmatter.join('\n')}\n---\n\n${body.trimStart()}`;
}

/**
 * Write every command of a skill into each selected agent. Agents sharing a
 * command directory resolve to the same path, so the file is written and
 * reported once.
 */
export async function installCommandsForAgents(
  commands: readonly SkillCommandDefinition[],
  agents: readonly AgentDefinition[],
  projectRoot: string
): Promise<InstalledCommand[]> {
  const installed: InstalledCommand[] = [];
  const seen = new Set<string>();
  for (const command of commands) {
    const body = await readFile(commandAssetPath(command.body), 'utf8');
    for (const agent of agents) {
      const target = resolveCommandTarget(agent, projectRoot, command.name);
      if (!target || seen.has(target.path)) continue;
      seen.add(target.path);

      const content = renderCommand(agent, command, body);
      let existing: string | undefined;
      try {
        existing = await readFile(target.path, 'utf8');
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (existing !== content) {
        await mkdir(path.dirname(target.path), { recursive: true });
        await writeFile(target.path, content, 'utf8');
      }
      installed.push({ agent, command, path: target.path, invocation: target.invocation, changed: existing !== content });
    }
  }
  return installed;
}
