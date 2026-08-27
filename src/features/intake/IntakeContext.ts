import { createContext, useContext } from 'react';

export interface ImageIntakeController {
  readonly openImageIntake: (files: readonly File[]) => void;
}

export const ImageIntakeContext = createContext<ImageIntakeController | null>(null);

export function useImageIntake(): ImageIntakeController {
  const controller = useContext(ImageIntakeContext);
  if (!controller) throw new Error('useImageIntake must be used inside ImageIntakeContext.');
  return controller;
}
