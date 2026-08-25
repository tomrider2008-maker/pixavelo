interface IntakeSession {
  readonly files: readonly File[];
  readonly createdAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, IntakeSession>();

function createSessionId() {
  return crypto.randomUUID();
}

function removeExpiredSessions() {
  const oldestAllowed = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < oldestAllowed) sessions.delete(id);
  }
}

export function createIntakeSession(files: readonly File[]): string {
  removeExpiredSessions();
  const id = createSessionId();
  sessions.set(id, { files: [...files], createdAt: Date.now() });
  return id;
}

export function getIntakeSession(id: string | undefined): readonly File[] {
  if (!id) return [];
  removeExpiredSessions();
  return sessions.get(id)?.files ?? [];
}

export function clearIntakeSession(id: string | undefined): void {
  if (id) sessions.delete(id);
}
