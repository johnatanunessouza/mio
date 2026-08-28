import type { InstructionDefinition } from './types.js';

/**
 * Always-on documents mio merges into the file each agent loads at the start
 * of a session. Unlike skills, these are not invoked — they are context.
 */
export const INSTRUCTION_CATALOG: readonly InstructionDefinition[] = [
  {
    id: 'response-protocol',
    name: 'Response protocol',
    description: 'Dense, indexable final answers (STATUS/RESUMO/ARQUIVOS/DECISOES/RISCOS/PROXIMA_ACAO)',
    isDefault: true,
  },
];

export function listInstructions(): InstructionDefinition[] {
  return [...INSTRUCTION_CATALOG];
}

export function listDefaultInstructions(): InstructionDefinition[] {
  return INSTRUCTION_CATALOG.filter((instruction) => instruction.isDefault);
}

export function resolveInstructions(ids: readonly string[]): InstructionDefinition[] {
  const requested = ids.map((id) => id.trim().toLowerCase()).filter(Boolean);
  const unknown = requested.filter((id) => !INSTRUCTION_CATALOG.some((instruction) => instruction.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown instruction: ${unknown.join(', ')}. Accepted instructions: ${INSTRUCTION_CATALOG.map((instruction) => instruction.id).join(', ')}`);
  }
  return INSTRUCTION_CATALOG.filter((instruction) => requested.includes(instruction.id));
}
