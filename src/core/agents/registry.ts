import type { AgentDefinition } from './types.js';

/** A stable, product-neutral catalog of supported local agent targets. */
export const AGENT_CATALOG: readonly AgentDefinition[] = [
  { id: 'agents', name: 'Shared .agents skills', available: true, skillsDir: '.agents', detectionPaths: ['.agents/skills'] },
  { id: 'amazon-q', name: 'Amazon Q Developer', available: true, skillsDir: '.amazonq', requiresIdeRestart: true },
  { id: 'antigravity', name: 'Antigravity', available: true, skillsDir: '.agents', legacySkillsDirs: ['.agent'], detectionPaths: ['.agent', '.agents/workflows'], requiresIdeRestart: true },
  { id: 'auggie', name: 'Auggie (Augment CLI)', available: true, skillsDir: '.augment' },
  { id: 'bob', name: 'Bob Shell', available: true, skillsDir: '.bob' },
  { id: 'claude', name: 'Claude Code', available: true, skillsDir: '.claude', commandsDir: '.claude/commands', instructionsFile: 'CLAUDE.md', globalInstructionsFile: '.claude/CLAUDE.md' },
  { id: 'cline', name: 'Cline', available: true, skillsDir: '.cline', requiresIdeRestart: true },
  { id: 'codeartsagent', name: 'CodeArts', available: true, skillsDir: '.codeartsdoer' },
  { id: 'codebuddy', name: 'CodeBuddy Code (CLI)', available: true, skillsDir: '.codebuddy' },
  { id: 'codex', name: 'Codex', available: true, skillsDir: '.agents', legacySkillsDirs: ['.codex'], detectionPaths: ['.agents/skills', '.codex/skills'], globalInstructionsFile: '.codex/AGENTS.md' },
  { id: 'command-code', name: 'Command Code', available: true, skillsDir: '.commandcode' },
  { id: 'continue', name: 'Continue', available: true, skillsDir: '.continue', requiresIdeRestart: true },
  { id: 'costrict', name: 'CoStrict', available: true, skillsDir: '.cospec', requiresIdeRestart: true },
  { id: 'crush', name: 'Crush', available: true, skillsDir: '.crush' },
  { id: 'cursor', name: 'Cursor', available: true, skillsDir: '.cursor', commandsDir: '.cursor/commands', commandStyle: 'prefixed-file', requiresIdeRestart: true },
  { id: 'devin', name: 'Devin Desktop (formerly Windsurf)', available: true, skillsDir: '.devin', detectionPaths: ['.devin', '.windsurf'], requiresIdeRestart: true },
  { id: 'factory', name: 'Factory Droid', available: true, skillsDir: '.factory' },
  { id: 'forgecode', name: 'ForgeCode', available: true, skillsDir: '.forge' },
  { id: 'gemini', name: 'Gemini CLI', available: true, skillsDir: '.gemini', instructionsFile: 'GEMINI.md', globalInstructionsFile: '.gemini/GEMINI.md' },
  { id: 'github-copilot', name: 'GitHub Copilot', available: true, skillsDir: '.github', detectionPaths: ['.github/copilot-instructions.md', '.github/instructions', '.github/workflows/copilot-setup-steps.yml', '.github/prompts', '.github/agents', '.github/skills', '.github/mcp.json'], commandsDir: '.github/prompts', commandStyle: 'prefixed-file', commandExtension: '.prompt.md', instructionsFile: '.github/copilot-instructions.md', requiresIdeRestart: true },
  { id: 'hermes', name: 'Hermes Agent', available: true, skillsDir: '.hermes', detectionPaths: ['.hermes', 'HERMES.md', '.hermes.md'], setupNote: 'Configure Hermes to include this project skills directory.' },
  { id: 'iflow', name: 'iFlow', available: true, skillsDir: '.iflow' },
  { id: 'junie', name: 'Junie', available: true, skillsDir: '.junie', requiresIdeRestart: true },
  { id: 'kilocode', name: 'Kilo Code', available: true, skillsDir: '.kilocode', requiresIdeRestart: true },
  { id: 'kimi', name: 'Kimi Code', available: true, skillsDir: '.kimi-code', detectionPaths: ['.kimi-code', '.kimi'] },
  { id: 'kiro', name: 'Kiro', available: true, skillsDir: '.kiro', requiresIdeRestart: true },
  { id: 'lingma', name: 'Lingma', available: true, skillsDir: '.lingma', requiresIdeRestart: true },
  { id: 'minimax-code', name: 'MiniMax Code', available: true, globalSkillsDir: '.minimax' },
  { id: 'oh-my-pi', name: 'Oh My Pi', available: true, skillsDir: '.omp' },
  { id: 'opencode', name: 'OpenCode', available: true, skillsDir: '.opencode' },
  { id: 'pi', name: 'Pi', available: true, skillsDir: '.pi' },
  { id: 'qoder', name: 'Qoder', available: true, skillsDir: '.qoder', requiresIdeRestart: true },
  { id: 'qwen', name: 'Qwen Code', available: true, skillsDir: '.qwen' },
  { id: 'roocode', name: 'Zoo Code', available: true, skillsDir: '.roo', requiresIdeRestart: true },
  { id: 'rovodev', name: 'Rovo Dev CLI', available: true, skillsDir: '.rovodev', detectionPaths: ['.rovodev/skills', '.rovodev'] },
  { id: 'trae', name: 'Trae', available: true, skillsDir: '.trae', requiresIdeRestart: true },
  { id: 'vibe', name: 'Mistral Vibe', available: true, skillsDir: '.vibe' },
  { id: 'zcode', name: 'ZCode', available: true, skillsDir: '.zcode' },
  { id: 'zed', name: 'Zed Agent', available: true, skillsDir: '.agents', detectionPaths: ['.zed', '.agents/skills'] }
];

export const AGENT_ALIASES: Readonly<Record<string, string>> = { windsurf: 'devin' };

export function listAgents(): AgentDefinition[] {
  return [...AGENT_CATALOG].sort((left, right) => left.id.localeCompare(right.id));
}

export function resolveAgentId(id: string): string {
  return AGENT_ALIASES[id.trim().toLowerCase()] ?? id.trim().toLowerCase();
}

export function resolveAgents(ids: readonly string[]): AgentDefinition[] {
  const requested = ids.map(resolveAgentId);
  const unknown = requested.filter((id) => !AGENT_CATALOG.some((agent) => agent.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown agent: ${unknown.join(', ')}. Accepted agents: ${listAgents().map((agent) => agent.id).join(', ')}`);
  }
  return [...new Map(requested.map((id) => [id, AGENT_CATALOG.find((agent) => agent.id === id)!])).values()];
}
