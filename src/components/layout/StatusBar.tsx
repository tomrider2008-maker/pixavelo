import { CloudOff, Files, WifiOff } from 'lucide-react';
import { en } from '../../i18n/en';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useProcessingActivity } from '../../stores/processingActivity';

export function StatusBar() {
  const online = useOnlineStatus();
  const activity = useProcessingActivity();

  return (
    <footer className="status-bar" aria-label="Application status">
      <span>
        <i className="status-bar__ready" aria-hidden="true" />
        {activity.active > 0 ? 'Processing locally' : en.status.ready}
      </span>
      <span title="Core application resources are cached for offline use">
        {online ? (
          <CloudOff size={16} aria-hidden="true" />
        ) : (
          <WifiOff size={16} aria-hidden="true" />
        )}
        {online ? en.status.offlineCapable : 'You are offline'}
      </span>
      <span>
        <Files size={15} aria-hidden="true" />
        {activity.queued} file{activity.queued === 1 ? '' : 's'} queued
      </span>
    </footer>
  );
}
