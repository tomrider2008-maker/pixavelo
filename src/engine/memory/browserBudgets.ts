export const MEBIBYTE = 1024 * 1024;

export const MAX_COLLECTION_FILES = 500;
export const MAX_COLLECTION_SOURCE_BYTES = 512 * MEBIBYTE;
export const MAX_RETAINED_OUTPUT_BYTES = 512 * MEBIBYTE;
export const MAX_ARCHIVE_BYTES = 512 * MEBIBYTE;
export const INTAKE_CONCURRENCY = 4;

export function totalBlobBytes(items: readonly { readonly size: number }[]) {
  return items.reduce((total, item) => total + item.size, 0);
}

export function filesWithinCollectionBudget(
  existing: readonly { readonly size: number }[],
  incoming: readonly File[]
) {
  let count = existing.length;
  let bytes = totalBlobBytes(existing);
  const accepted: File[] = [];
  for (const file of incoming) {
    if (count >= MAX_COLLECTION_FILES || bytes + file.size > MAX_COLLECTION_SOURCE_BYTES) break;
    accepted.push(file);
    count += 1;
    bytes += file.size;
  }
  return accepted;
}
