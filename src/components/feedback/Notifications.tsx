import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

type NotificationTone = 'info' | 'success' | 'error';

interface NotificationInput {
  readonly title: string;
  readonly message?: string;
  readonly tone?: NotificationTone;
}

interface Notification extends NotificationInput {
  readonly id: string;
  readonly tone: NotificationTone;
}

interface NotificationsContextValue {
  readonly notify: (notification: NotificationInput) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function createId() {
  return crypto.randomUUID();
}

export function NotificationsProvider({ children }: { readonly children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback(
    (input: NotificationInput) => {
      const notification: Notification = {
        ...input,
        id: createId(),
        tone: input.tone ?? 'info'
      };
      setNotifications((current) => [...current, notification]);
      window.setTimeout(() => dismiss(notification.id), 6000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationsContext value={value}>
      {children}
      <div className="toast-region" role="region" aria-live="polite" aria-label="Notifications">
        {notifications.map((notification) => {
          const Icon =
            notification.tone === 'success'
              ? CheckCircle2
              : notification.tone === 'error'
                ? CircleAlert
                : Info;

          return (
            <div className={`toast toast--${notification.tone}`} key={notification.id}>
              <Icon size={19} aria-hidden="true" />
              <div className="toast__copy">
                <strong>{notification.title}</strong>
                {notification.message ? <span>{notification.message}</span> : null}
              </div>
              <button
                className="icon-button icon-button--small"
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(notification.id)}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationsContext>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationsProvider.');
  return context;
}
