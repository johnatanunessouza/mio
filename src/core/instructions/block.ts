/**
 * How a managed block's markers are spelled in the host document. Markdown
 * files (`AGENTS.md`) hide them in HTML comments; YAML files (`openspec/
 * config.yaml`) use `#`, the only comment YAML has.
 */
export type BlockCommentStyle = 'html' | 'yaml';

const COMMENT: Record<BlockCommentStyle, (text: string) => string> = {
  html: (text) => `<!-- ${text} -->`,
  yaml: (text) => `# ${text}`,
};

export function beginMarker(id: string, style: BlockCommentStyle = 'html'): string {
  return COMMENT[style](`BEGIN MIO: ${id}`);
}

export function endMarker(id: string, style: BlockCommentStyle = 'html'): string {
  return COMMENT[style](`END MIO: ${id}`);
}

/**
 * Replace the `BEGIN MIO: id` block of a document, appending it when absent.
 * Everything outside the markers is preserved byte-for-byte, so the file stays
 * the user's (or another generator's) to edit.
 */
export function mergeManagedBlock(
  original: string,
  id: string,
  content: string,
  style: BlockCommentStyle = 'html'
): string {
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const begin = beginMarker(id, style);
  const end = endMarker(id, style);
  const block = [begin, ...content.trim().split(/\r?\n/), end];

  const body = original.endsWith('\n') ? original.replace(/\r?\n$/, '') : original;
  const lines = body.length === 0 ? [] : body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === begin);

  if (start === -1) {
    const trimmed = [...lines];
    while (trimmed.length > 0 && trimmed.at(-1)!.trim() === '') trimmed.pop();
    const next = trimmed.length === 0 ? block : [...trimmed, '', ...block];
    return `${next.join(newline)}${newline}`;
  }

  // An unterminated block would otherwise swallow the rest of the file, so a
  // missing end marker is treated as a block that ends at the begin marker.
  const relativeEnd = lines.slice(start + 1).findIndex((line) => line.trim() === end);
  const after = relativeEnd === -1 ? start + 1 : start + 1 + relativeEnd + 1;
  return `${[...lines.slice(0, start), ...block, ...lines.slice(after)].join(newline)}${newline}`;
}
