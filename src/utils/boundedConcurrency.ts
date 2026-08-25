export async function mapWithConcurrency<Input, Output>(
  items: readonly Input[],
  concurrency: number,
  task: (item: Input, index: number) => Promise<Output>
): Promise<Output[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1));
  const results = new Array<Output>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (item !== undefined) results[index] = await task(item, index);
      }
    })
  );
  return results;
}
