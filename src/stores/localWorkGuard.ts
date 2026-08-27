import { useSyncExternalStore } from 'react';

const sources = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => sources.size > 0;

export function hasLocalWorkGuard() {
  return getSnapshot();
}

export function setLocalWorkGuard(source: string, active: boolean) {
  const wasActive = getSnapshot();
  if (active) sources.add(source);
  else sources.delete(source);
  if (wasActive === getSnapshot()) return;
  for (const listener of listeners) listener();
}

export function useLocalWorkGuard() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
