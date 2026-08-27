import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasLocalWorkGuard } from '../stores/localWorkGuard';
import { clearIntakeSession, createIntakeSession, getIntakeSession } from './intakeSession';

describe('intakeSession', () => {
  const createdIds: string[] = [];

  afterEach(() => {
    for (const id of createdIds) clearIntakeSession(id);
    createdIds.length = 0;
    vi.useRealTimers();
  });

  it('keeps files in memory and returns defensive array copies', () => {
    const first = new File(['one'], 'one.png', { type: 'image/png' });
    const source = [first];
    const id = remember(createIntakeSession(source));
    expect(hasLocalWorkGuard()).toBe(true);
    source.length = 0;

    const received = getIntakeSession(id);
    expect(received).toEqual([first]);
    (received as File[]).length = 0;
    expect(getIntakeSession(id)).toEqual([first]);
  });

  it('clears a known session and treats unknown identifiers as empty', () => {
    const id = remember(createIntakeSession([new File(['x'], 'x.png')]));
    clearIntakeSession(id);

    expect(getIntakeSession(id)).toEqual([]);
    expect(hasLocalWorkGuard()).toBe(false);
    expect(getIntakeSession('missing')).toEqual([]);
    expect(getIntakeSession(undefined)).toEqual([]);
  });

  it('expires sessions after the bounded 30-minute handoff window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T00:00:00Z'));
    const id = remember(createIntakeSession([new File(['x'], 'x.png')]));
    vi.setSystemTime(new Date('2026-08-27T00:30:00.001Z'));

    expect(getIntakeSession(id)).toEqual([]);
    expect(hasLocalWorkGuard()).toBe(false);
  });

  it('releases orphaned work guards when the handoff timer expires', () => {
    vi.useFakeTimers();
    const id = remember(createIntakeSession([new File(['x'], 'x.png')]));
    expect(hasLocalWorkGuard()).toBe(true);

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(hasLocalWorkGuard()).toBe(false);
    expect(getIntakeSession(id)).toEqual([]);
  });

  function remember(id: string) {
    createdIds.push(id);
    return id;
  }
});
