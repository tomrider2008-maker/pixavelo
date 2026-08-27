import { useCallback } from 'react';
import { useImageTool } from './useImageTool';
import { useIntakeSessionConsumer } from './useIntakeSessionConsumer';

export function useIncomingImageTool() {
  const tool = useImageTool();
  const chooseFile = tool.chooseFile;
  const consumeIncomingFiles = useCallback(
    (files: readonly File[]) => chooseFile(files[0]),
    [chooseFile]
  );
  useIntakeSessionConsumer(consumeIncomingFiles);

  return tool;
}
