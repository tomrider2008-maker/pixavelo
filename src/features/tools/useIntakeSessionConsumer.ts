import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { clearIntakeSession, getIntakeSession } from '../../services/intakeSession';
import { setLocalWorkGuard } from '../../stores/localWorkGuard';

interface IntakeLocationState {
  readonly sessionId?: string;
}

type IntakeSessionConsumer = (files: readonly File[]) => unknown;

export function useIntakeSessionConsumer(consumeFiles: IntakeSessionConsumer) {
  const location = useLocation();
  const state = location.state as IntakeLocationState | null;
  const sessionId = state?.sessionId;
  const consumedSessionRef = useRef<string | undefined>(undefined);
  const destinationGuardsRef = useRef(new Set<string>());
  const settledGuardsRef = useRef<string[]>([]);
  const [settlementVersion, setSettlementVersion] = useState(0);

  useEffect(() => {
    for (const source of settledGuardsRef.current.splice(0)) {
      setLocalWorkGuard(source, false);
      destinationGuardsRef.current.delete(source);
    }
  }, [settlementVersion]);

  useEffect(
    () => () => {
      for (const source of destinationGuardsRef.current) setLocalWorkGuard(source, false);
      destinationGuardsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!sessionId || consumedSessionRef.current === sessionId) return;
    consumedSessionRef.current = sessionId;
    const files = getIntakeSession(sessionId);
    if (files.length === 0) {
      clearIntakeSession(sessionId);
      return;
    }

    const destinationGuard = `intake-consumer:${sessionId}`;
    destinationGuardsRef.current.add(destinationGuard);
    setLocalWorkGuard(destinationGuard, true);

    let consumption: unknown;
    try {
      consumption = consumeFiles(files);
    } catch (error: unknown) {
      clearIntakeSession(sessionId);
      setLocalWorkGuard(destinationGuard, false);
      destinationGuardsRef.current.delete(destinationGuard);
      throw error;
    }

    void Promise.resolve(consumption).then(
      () => {
        clearIntakeSession(sessionId);
        if (!destinationGuardsRef.current.has(destinationGuard)) return;
        settledGuardsRef.current.push(destinationGuard);
        setSettlementVersion((current) => current + 1);
      },
      () => {
        clearIntakeSession(sessionId);
        setLocalWorkGuard(destinationGuard, false);
        destinationGuardsRef.current.delete(destinationGuard);
      }
    );
  }, [consumeFiles, sessionId]);
}
