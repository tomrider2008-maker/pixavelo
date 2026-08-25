import { describe, expect, it } from 'vitest';
import { filesWithinCollectionBudget, MAX_COLLECTION_FILES } from './browserBudgets';

describe('browser collection budgets', () => {
  it('accepts a 205-file enterprise batch and caps excessive counts', () => {
    const files = Array.from(
      { length: MAX_COLLECTION_FILES + 20 },
      (_, index) => new File([new Uint8Array([index % 255])], `file-${index}.png`)
    );
    expect(filesWithinCollectionBudget([], files)).toHaveLength(MAX_COLLECTION_FILES);
    expect(filesWithinCollectionBudget([], files.slice(0, 205))).toHaveLength(205);
  });

  it('stops before exceeding the aggregate byte budget', () => {
    const files = [
      { name: 'a.png', size: 400 * 1024 * 1024 },
      { name: 'b.png', size: 200 * 1024 * 1024 }
    ] as File[];
    expect(filesWithinCollectionBudget([], files)).toHaveLength(1);
  });
});
