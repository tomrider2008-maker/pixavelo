import { useSyncExternalStore } from 'react';
import type { ProcessingStage } from '../types/images';

interface ProcessingActivity {
  readonly queued: number;
  readonly active: number;
  readonly stage?: ProcessingStage;
}

const emptyActivity: ProcessingActivity = { queued: 0, active: 0 };
let activity: ProcessingActivity = emptyActivity;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => activity;

export function hasProcessingActivity() {
  return activity.active > 0 || activity.queued > 0;
}

export function setProcessingActivity(next: ProcessingActivity) {
  if (
    activity.queued === next.queued &&
    activity.active === next.active &&
    activity.stage === next.stage
  )
    return;
  activity = next;
  for (const listener of listeners) listener();
}

export function clearProcessingActivity() {
  setProcessingActivity(emptyActivity);
}

export function useProcessingActivity() {
  return useSyncExternalStore(subscribe, getSnapshot, () => emptyActivity);
}
