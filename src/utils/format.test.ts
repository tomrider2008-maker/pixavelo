import { describe, expect, it } from 'vitest';
import { formatBytes, formatReduction } from './format';

describe('display formatters', () => {
  it('formats byte units without overstating precision', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2.25 * 1024 * 1024)).toBe('2.3 MB');
  });

  it('describes both reductions and increases', () => {
    expect(formatReduction(1000, 250)).toBe('75% smaller');
    expect(formatReduction(1000, 1250)).toBe('25% larger');
    expect(formatReduction(0, 0)).toBe('0%');
  });
});
