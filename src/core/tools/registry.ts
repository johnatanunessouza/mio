import { cavemanInstaller } from './caveman.js';
import { cavemanSkillsInstaller } from './caveman-skills.js';
import { codegraphInstaller } from './codegraph.js';
import { openspecInstaller } from './openspec.js';
import type { ToolDefinition, ToolId, ToolInstaller } from './types.js';

/** Installable tools offered by `mio init`, in menu order. */
export const TOOL_INSTALLERS: readonly ToolInstaller[] = [codegraphInstaller, openspecInstaller, cavemanInstaller, cavemanSkillsInstaller];

export const TOOL_CATALOG: readonly ToolDefinition[] = TOOL_INSTALLERS.map((installer) => installer.definition);

export function listTools(): ToolDefinition[] {
  return [...TOOL_CATALOG];
}

export function resolveTools(ids: readonly string[]): ToolInstaller[] {
  const requested = ids.map((id) => id.trim().toLowerCase()).filter(Boolean);
  const unknown = requested.filter((id) => !TOOL_CATALOG.some((tool) => tool.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown tool: ${unknown.join(', ')}. Accepted tools: ${TOOL_CATALOG.map((tool) => tool.id).join(', ')}`);
  }
  return [...new Map(requested.map((id) => [id, TOOL_INSTALLERS.find((installer) => installer.definition.id === id)!])).values()];
}

export function isToolId(value: string): value is ToolId {
  return TOOL_CATALOG.some((tool) => tool.id === value);
}
