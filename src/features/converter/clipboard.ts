const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif'
};

export function filesFromClipboardData(data: DataTransfer): readonly File[] {
  return Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

export async function readClipboardImageFiles(): Promise<readonly File[]> {
  const read = Reflect.get(navigator.clipboard, 'read') as Clipboard['read'] | undefined;
  if (typeof read !== 'function') throw new Error('Clipboard image reading is unavailable.');
  const items = await read.call(navigator.clipboard);
  const files: File[] = [];
  let index = 0;
  for (const item of items) {
    const mime = item.types.find((type) => type.startsWith('image/'));
    if (!mime) continue;
    const blob = await item.getType(mime);
    const extension = extensionByMime[mime] ?? mime.split('/')[1] ?? 'image';
    index += 1;
    files.push(
      new File([blob], `clipboard-image-${String(index).padStart(2, '0')}.${extension}`, {
        type: mime,
        lastModified: Date.now()
      })
    );
  }
  return files;
}
