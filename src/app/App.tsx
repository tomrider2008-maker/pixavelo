import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { NotificationsProvider } from '../components/feedback/Notifications';
import { ServiceWorkerUpdate } from '../components/feedback/ServiceWorkerUpdate';
import { PreferencesProvider } from '../stores/preferences';
import { router } from './router';

export function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <NotificationsProvider>
          <RouterProvider router={router} />
          <ServiceWorkerUpdate />
        </NotificationsProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}
