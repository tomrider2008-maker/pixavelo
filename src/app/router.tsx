import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { RouteErrorPage } from '../components/feedback/RouteErrorPage';

const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const ConverterPage = lazy(() => import('../features/converter/ConverterPage'));
const OptimizePage = lazy(() => import('../features/optimize/OptimizePage'));
const ResizePage = lazy(() => import('../features/resize/ResizePage'));
const BatchPage = lazy(() => import('../features/batch/BatchPage'));
const EditorPage = lazy(() => import('../features/editor/EditorPage'));
const PrivacyPage = lazy(() => import('../features/privacy/PrivacyPage'));
const WebAssetPage = lazy(() => import('../features/web-assets/WebAssetPage'));
const DeveloperToolsPage = lazy(() => import('../features/developer-tools/DeveloperToolsPage'));
const SecurityPage = lazy(() => import('../features/privacy/SecurityPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const HelpPage = lazy(() => import('../features/help/HelpPage'));
const NotFoundPage = lazy(() => import('../features/help/NotFoundPage'));

function pending(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__mark" aria-hidden="true" />
      <span>Opening workspace…</span>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: pending(<DashboardPage />) },
      { path: 'convert', element: pending(<ConverterPage />) },
      { path: 'optimize', element: pending(<OptimizePage />) },
      { path: 'resize', element: pending(<ResizePage />) },
      { path: 'batch', element: pending(<BatchPage />) },
      { path: 'edit', element: pending(<EditorPage />) },
      { path: 'privacy', element: pending(<PrivacyPage />) },
      { path: 'security', element: pending(<SecurityPage />) },
      { path: 'web-assets', element: pending(<WebAssetPage />) },
      { path: 'developer-tools', element: pending(<DeveloperToolsPage />) },
      { path: 'settings', element: pending(<SettingsPage />) },
      { path: 'help', element: pending(<HelpPage />) },
      { path: '*', element: pending(<NotFoundPage />) }
    ]
  }
]);
