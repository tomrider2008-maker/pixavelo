import { describe, expect, it } from 'vitest';
import { calculateVirtualWindow } from './virtualWindow';

describe('Batch virtual window', () => {
  it('renders a bounded overscanned slice for hundreds of rows', () => {
    expect(calculateVirtualWindow(240, 86, 516, 86 * 100, 4)).toEqual({
      start: 96,
      end: 110,
      before: 8256,
      after: 11_180
    });
  });

  it('clamps windows at both list boundaries', () => {
    expect(calculateVirtualWindow(10, 86, 516, 0, 4)).toEqual({
      start: 0,
      end: 10,
      before: 0,
      after: 0
    });
    expect(calculateVirtualWindow(0, 86, 516, 0)).toEqual({
      start: 0,
      end: 0,
      before: 0,
      after: 0
    });
  });
});
