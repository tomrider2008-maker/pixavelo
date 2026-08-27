import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { CommandPalette } from './CommandPalette';
import { MobileNavigation } from './MobileNavigation';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { hasSeenWelcome, markWelcomeSeen } from '../../features/welcome/welcomePreference';

const WelcomeDialog = lazy(() =>
  import('../../features/welcome/WelcomeDialog').then((m) => ({ default: m.WelcomeDialog }))
);

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  // Lazy initializer: read localStorage once on mount, not in an effect
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome());
  const chooseInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const closeCommand = useCallback(() => setCommandOpen(false), []);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  const handleWelcomeClose = useCallback(() => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  }, []);

  // Allow reopening from Settings via a custom event
  useEffect(() => {
    const handler = () => {
      setWelcomeOpen(true);
    };
    window.addEventListener('pixavelo:show-welcome', handler);
    return () => window.removeEventListener('pixavelo:show-welcome', handler);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppHeader
        onOpenCommand={() => setCommandOpen(true)}
        onOpenNavigation={() => setNavigationOpen(true)}
      />
      <Sidebar mobileOpen={navigationOpen} onClose={closeNavigation} />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <StatusBar />
      <input
        ref={chooseInputRef}
        className="sr-only"
        type="file"
        aria-label="Choose image files"
        accept="image/*,.jfif,.heic,.heif,.tif,.tiff,.ico"
        multiple
        tabIndex={-1}
        aria-hidden="true"
      />
      <MobileNavigation
        onChoose={() => {
          const pageInput = document.querySelector<HTMLInputElement>('[data-image-input]');
          (pageInput ?? chooseInputRef.current)?.click();
        }}
        onMore={() => setNavigationOpen(true)}
      />
      <CommandPalette open={commandOpen} onClose={closeCommand} />
      <Suspense fallback={null}>
        <WelcomeDialog open={welcomeOpen} onClose={handleWelcomeClose} />
      </Suspense>
    </div>
  );
}
