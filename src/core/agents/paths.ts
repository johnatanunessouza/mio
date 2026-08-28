import path from 'node:path';
import { homedir } from 'node:os';
import type { AgentDefinition } from './types.js';

function confinedPath(root: string, target: string): string {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, target);
  const relative = path.relative(absoluteRoot, resolved);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside the allowed target root: ${target}`);
  }
  return resolved;
}

export function resolveAgentOutputPath(
  agent: AgentDefinition,
  projectRoot: string,
  global: boolean,
  globalHome = homedir()
): string {
  if (global) {
    if (!agent.globalSkillsDir) {
      throw new Error(`${agent.id} does not support global configuration`);
    }
    return confinedPath(globalHome, path.join(agent.globalSkillsDir, 'skills', 'mio-skeleton.md'));
  }
  if (!agent.skillsDir) {
    throw new Error(`${agent.id} does not support local configuration`);
  }
  return confinedPath(projectRoot, path.join(agent.skillsDir, 'skills', 'mio-skeleton.md'));
}
