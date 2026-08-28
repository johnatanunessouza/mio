import { Command } from 'commander';
import { createRequire } from 'node:module';
import { registerAgentCommand } from '../commands/agent.js';
import { registerInitCommand } from '../commands/init.js';
import { registerInstructionsCommand } from '../commands/instructions.js';
import { registerSkillCommand } from '../commands/skill.js';
import { registerSkillsListCommand } from '../commands/skills-list.js';
import { notifyAboutUpdate } from '../core/update/notifier.js';

const require = createRequire(import.meta.url);
const { version, name, repository } = require('../../package.json') as {
  version: string;
  name: string;
  repository?: { url?: string };
};

export function createProgram(): Command {
  const program = new Command();
  program
    .name('mio')
    .description('A neutral, reusable Node.js CLI foundation')
    .version(version)
    .option('--no-color', 'Disable color output')
    .option('--no-update-check', 'Do not check whether a newer release exists')
    .showHelpAfterError();
  program.hook('preAction', (command) => {
    if (command.opts().color === false) process.env.NO_COLOR = '1';
  });
  registerInitCommand(program);
  registerAgentCommand(program);
  registerSkillCommand(program);
  registerSkillsListCommand(program);
  registerInstructionsCommand(program);
  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
  // After the command, never before: the notice is a footnote, and the lookup
  // behind it belongs to a detached process.
  await notifyAboutUpdate({
    currentVersion: version,
    packageName: name,
    repositoryUrl: repository?.url,
    enabled: program.opts().updateCheck !== false
  });
}
