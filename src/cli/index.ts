import { Command } from 'commander';
import { createRequire } from 'node:module';
import { registerAgentCommand } from '../commands/agent.js';
import { registerInitCommand } from '../commands/init.js';
import { registerInstructionsCommand } from '../commands/instructions.js';
import { registerSkillCommand } from '../commands/skill.js';
import { registerSkillsListCommand } from '../commands/skills-list.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

export function createProgram(): Command {
  const program = new Command();
  program
    .name('mio')
    .description('A neutral, reusable Node.js CLI foundation')
    .version(version)
    .option('--no-color', 'Disable color output')
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
}
