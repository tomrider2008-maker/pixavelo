import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { NotificationsProvider } from '../components/feedback/Notifications';
import { PreferencesProvider } from '../stores/preferences';
import { router } from './router';

export function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <NotificationsProvider>
          <RouterProvider router={router} />
        </NotificationsProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}
