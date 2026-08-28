/**
 * Guidance mio writes into a project's `openspec/config.yaml` on behalf of a
 * skill. A skill that changes how a workflow must be run carries the rule that
 * says so, instead of every project having to remember to paste it in.
 */
export interface OpenspecGuidance {
  /** Skill whose presence in the project turns this guidance on. */
  skillId: string;
  /** Top-level key of `openspec/config.yaml` the guidance is written under. */
  section: string;
  lines: readonly string[];
}

/** Marker id of the block mio owns inside `openspec/config.yaml`. */
export const OPENSPEC_GUIDANCE_BLOCK_ID = 'openspec-guidance';

/**
 * Skill-triggered guidance, in the order it is written to the config file.
 */
export const OPENSPEC_GUIDANCE_CATALOG: readonly OpenspecGuidance[] = [
  {
    skillId: 'code-review',
    section: 'archive',
    lines: [
      'Antes de arquivar, confirmar que a skill code-review já rodou sobre o diff completo do change nesta sessão'
        + ' (ou pedir ao usuário confirmação de que já rodou em outra) — se não tiver rodado ainda, rodar agora'
        + ' e reportar os achados antes de prosseguir com o archive',
    ],
  },
];

/** Catalog entries contributed by the given skills, in catalog order. */
export function guidanceForSkills(skillIds: Iterable<string>): OpenspecGuidance[] {
  const wanted = new Set([...skillIds].map((id) => id.trim().toLowerCase()).filter(Boolean));
  return OPENSPEC_GUIDANCE_CATALOG.filter((entry) => wanted.has(entry.skillId));
}

/** Every skill that contributes guidance, so callers know what to look for. */
export function guidanceSkillIds(): string[] {
  return [...new Set(OPENSPEC_GUIDANCE_CATALOG.map((entry) => entry.skillId))];
}

const YAML_INDICATORS = '-?:,[]{}#&*!|>\'"%@`';
const YAML_RESERVED = /^(?:true|false|null|yes|no|on|off|~)$/i;

/**
 * Emit `value` as a YAML scalar. Plain style keeps the file readable; anything
 * YAML could reparse as punctuation, a boolean or a number is single-quoted,
 * where doubling `'` is the only escape the format needs.
 */
export function yamlScalar(value: string): string {
  const plain = value.length > 0
    && !YAML_INDICATORS.includes(value[0])
    && !value.includes(': ')
    && !value.includes(' #')
    && !value.endsWith(':')
    && !YAML_RESERVED.test(value)
    && Number.isNaN(Number(value));
  return plain ? value : `'${value.replaceAll("'", "''")}'`;
}

/**
 * Render the managed block body: one `<section>: guidance:` list per section,
 * with the lines of every contributing skill merged in catalog order.
 * Duplicates are dropped so two skills asking for the same rule write it once.
 */
export function renderGuidance(entries: readonly OpenspecGuidance[]): string {
  const sections = new Map<string, string[]>();
  for (const entry of entries) {
    const lines = sections.get(entry.section) ?? [];
    for (const line of entry.lines) {
      // Folded into a single line: a YAML scalar written this way cannot carry
      // the newlines a multi-line source string would introduce.
      const normalized = line.replace(/\s+/g, ' ').trim();
      if (normalized && !lines.includes(normalized)) lines.push(normalized);
    }
    sections.set(entry.section, lines);
  }

  const out: string[] = [];
  for (const [section, lines] of sections) {
    if (lines.length === 0) continue;
    out.push(`${section}:`, '  guidance:');
    for (const line of lines) out.push(`    - ${yamlScalar(line)}`);
  }
  return out.join('\n');
}
