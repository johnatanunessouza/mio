import { listDefaultInstructions } from '../core/instructions/registry.js';

/**
 * Resolve the instruction selection the same way skills are resolved: every
 * default document unless `--instructions` narrows it or opts out with "none".
 */
export function selectInstructionIds(supplied: string | undefined): string[] {
  if (supplied === undefined) return listDefaultInstructions().map((instruction) => instruction.id);
  const ids = supplied.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.some((id) => id.toLowerCase() === 'none')) return [];
  if (ids.some((id) => id.toLowerCase() === 'all')) return listDefaultInstructions().map((instruction) => instruction.id);
  return ids;
}
