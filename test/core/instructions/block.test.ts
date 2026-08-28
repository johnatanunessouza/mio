import { describe, expect, it } from 'vitest';
import { beginMarker, endMarker, mergeManagedBlock } from '../../../src/core/instructions/block.js';

const ID = 'response-protocol';
const BEGIN = beginMarker(ID);
const END = endMarker(ID);

describe('mergeManagedBlock', () => {
  it('creates the block in an empty document', () => {
    expect(mergeManagedBlock('', ID, 'rule')).toBe(`${BEGIN}\nrule\n${END}\n`);
  });

  it('appends after existing content, separated by a blank line', () => {
    expect(mergeManagedBlock('# Title\n', ID, 'rule')).toBe(`# Title\n\n${BEGIN}\nrule\n${END}\n`);
  });

  it('replaces only the block, preserving text around it', () => {
    const original = `# Title\n\n${BEGIN}\nold\n${END}\n\n## Mine\nkeep me\n`;
    expect(mergeManagedBlock(original, ID, 'new')).toBe(`# Title\n\n${BEGIN}\nnew\n${END}\n\n## Mine\nkeep me\n`);
  });

  it('is byte-for-byte idempotent', () => {
    const once = mergeManagedBlock('# Title\n', ID, 'rule');
    expect(mergeManagedBlock(once, ID, 'rule')).toBe(once);
  });

  it('keeps CRLF documents on CRLF', () => {
    expect(mergeManagedBlock('# Title\r\n', ID, 'rule')).toBe(`# Title\r\n\r\n${BEGIN}\r\nrule\r\n${END}\r\n`);
  });

  it('does not swallow the document when the end marker was deleted', () => {
    const original = `${BEGIN}\nold\n\n## Mine\nkeep me\n`;
    const merged = mergeManagedBlock(original, ID, 'new');
    expect(merged).toContain('keep me');
    expect(merged).toContain(`${BEGIN}\nnew\n${END}`);
  });

  it('leaves a block owned by another id alone', () => {
    const original = `<!-- BEGIN MIO: other -->\ntheirs\n<!-- END MIO: other -->\n`;
    const merged = mergeManagedBlock(original, ID, 'rule');
    expect(merged).toContain('theirs');
    expect(merged).toContain(BEGIN);
  });
});
