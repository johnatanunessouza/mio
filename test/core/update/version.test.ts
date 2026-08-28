import { describe, expect, it } from 'vitest';
import { isNewerVersion, normalizeVersion } from '../../../src/core/update/version.js';

describe('normalizeVersion', () => {
  it('drops the tag prefix', () => {
    expect(normalizeVersion('v1.12.0')).toBe('1.12.0');
    expect(normalizeVersion(' 1.12.0 ')).toBe('1.12.0');
  });
});

describe('isNewerVersion', () => {
  it('compares each component numerically, not lexically', () => {
    expect(isNewerVersion('1.12.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.9.0', '1.12.0')).toBe(false);
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true);
    expect(isNewerVersion('1.11.1', '1.11.0')).toBe(true);
  });

  it('is false for the version already installed', () => {
    expect(isNewerVersion('1.11.0', '1.11.0')).toBe(false);
    expect(isNewerVersion('v1.11.0', '1.11.0')).toBe(false);
  });

  it('never offers a pre-release', () => {
    expect(isNewerVersion('1.12.0-rc.1', '1.11.0')).toBe(false);
  });

  it('treats anything unparseable as not newer, so a bad tag cannot nag', () => {
    expect(isNewerVersion('latest', '1.11.0')).toBe(false);
    expect(isNewerVersion('1.12', '1.11.0')).toBe(false);
    expect(isNewerVersion('1.12.0', 'unknown')).toBe(false);
  });
});
