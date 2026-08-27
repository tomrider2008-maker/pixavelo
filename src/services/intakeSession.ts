import { setLocalWorkGuard } from '../stores/localWorkGuard';

interface IntakeSession {
  readonly files: readonly File[];
  readonly createdAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, IntakeSession>();
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function sessionWorkSource(id: string) {
  return `intake-session:${id}`;
}

function deleteSession(id: string) {
  const timer = expiryTimers.get(id);
  if (timer !== undefined) globalThis.clearTimeout(timer);
  expiryTimers.delete(id);
  sessions.delete(id);
  setLocalWorkGuard(sessionWorkSource(id), false);
}

function createSessionId() {
  return crypto.randomUUID();
}

function removeExpiredSessions() {
  const oldestAllowed = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < oldestAllowed) {
      deleteSession(id);
    }
  }
}

export function createIntakeSession(files: readonly File[]): string {
  removeExpiredSessions();
  const id = createSessionId();
  sessions.set(id, { files: [...files], createdAt: Date.now() });
  setLocalWorkGuard(sessionWorkSource(id), files.length > 0);
  expiryTimers.set(
    id,
    globalThis.setTimeout(() => deleteSession(id), SESSION_TTL_MS)
  );
  return id;
}

export function getIntakeSession(id: string | undefined): readonly File[] {
  if (!id) return [];
  removeExpiredSessions();
  return [...(sessions.get(id)?.files ?? [])];
}

export function clearIntakeSession(id: string | undefined): void {
  if (!id) return;
  deleteSession(id);
}
