import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { hasProcessingActivity, useProcessingActivity } from '../../stores/processingActivity';

interface ServiceWorkerUpdateProps {
  readonly reloadPage?: () => void;
}

export function ServiceWorkerUpdate({
  reloadPage = () => window.location.reload()
}: ServiceWorkerUpdateProps) {
  const activity = useProcessingActivity();
  const hasLocalWork = activity.active > 0 || activity.queued > 0;
  const reloadPageRef = useRef(reloadPage);
  const activationStartedRef = useRef(false);
  const reloadStartedRef = useRef(false);
  const updateExpectedRef = useRef(false);
  const hadControllerRef = useRef(
    'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)
  );
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [adoptionRequested, setAdoptionRequested] = useState(false);
  const [activatedWhileBusy, setActivatedWhileBusy] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    reloadPageRef.current = reloadPage;
  }, [reloadPage]);

  const requestSafeReload = useCallback(() => {
    if (!updateExpectedRef.current) return;
    if (hasProcessingActivity()) {
      setActivatedWhileBusy(true);
      return;
    }
    if (reloadStartedRef.current) return;
    reloadStartedRef.current = true;
    reloadPageRef.current();
  }, []);

  const handleControllerChange = useCallback(() => {
    if (!hadControllerRef.current) {
      hadControllerRef.current = true;
      return;
    }
    updateExpectedRef.current = true;
    requestSafeReload();
  }, [requestSafeReload]);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onNeedReload: requestSafeReload,
    onNeedRefresh() {
      updateExpectedRef.current = true;
    },
    onRegisteredSW(_scriptUrl, nextRegistration) {
      setRegistration(nextRegistration);
    }
  });

  const activateUpdate = useCallback(() => {
    if (activationStartedRef.current) return;
    if (hasProcessingActivity()) {
      setAdoptionRequested(true);
      return;
    }
    activationStartedRef.current = true;
    updateExpectedRef.current = true;
    setUpdating(true);
    const waitingWorker = registration?.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    void updateServiceWorker().catch(() => {
      activationStartedRef.current = false;
      setUpdating(false);
    });
  }, [registration, updateServiceWorker]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, [handleControllerChange]);

  useEffect(() => {
    if (!registration) return;
    const checkForUpdate = () => void registration.update().catch(() => undefined);
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [registration]);

  useEffect(() => {
    if (hasLocalWork || !adoptionRequested) return;
    const timer = window.setTimeout(() => {
      if (hasProcessingActivity()) return;
      if (activatedWhileBusy) requestSafeReload();
      else activateUpdate();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activateUpdate, activatedWhileBusy, adoptionRequested, hasLocalWork, requestSafeReload]);

  if (!needRefresh && !activatedWhileBusy) return null;

  const handleUpdate = () => {
    setAdoptionRequested(true);
    if (!hasLocalWork) activateUpdate();
  };
  const waitingForWork = hasLocalWork && adoptionRequested;

  return (
    <section
      className="service-worker-update"
      role="status"
      aria-live="polite"
      aria-labelledby="service-worker-update-title"
    >
      <RefreshCw size={21} aria-hidden="true" />
      <div className="service-worker-update__copy">
        <strong id="service-worker-update-title">New version available</strong>
        <span>
          {waitingForWork || activatedWhileBusy
            ? 'Your local work will finish before Pixavelo restarts.'
            : 'Update when you are ready. Selected images stay on this device.'}
        </span>
      </div>
      <button
        className="button button--primary"
        type="button"
        disabled={updating || waitingForWork || activatedWhileBusy}
        onClick={handleUpdate}
      >
        {waitingForWork || activatedWhileBusy
          ? 'Update queued'
          : updating
            ? 'Updating…'
            : hasLocalWork
              ? 'Update when finished'
              : 'Update Pixavelo'}
      </button>
    </section>
  );
}
