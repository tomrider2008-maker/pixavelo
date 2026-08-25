export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatReduction(sourceBytes: number, outputBytes: number): string {
  if (sourceBytes <= 0) return '0%';
  const reduction = Math.round((1 - outputBytes / sourceBytes) * 100);
  return reduction >= 0 ? `${reduction}% smaller` : `${Math.abs(reduction)}% larger`;
}
