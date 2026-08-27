import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { createIntakeSession } from '../../services/intakeSession';
import { ImageIntakeContext } from '../../features/intake/IntakeContext';
import { AppHeader } from './AppHeader';
import { CommandPalette } from './CommandPalette';
import { MobileNavigation } from './MobileNavigation';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { hasSeenWelcome, markWelcomeSeen } from '../../features/welcome/welcomePreference';
import { setLocalWorkGuard } from '../../stores/localWorkGuard';

const INTAKE_WORK_SOURCE = 'smart-intake';

const WelcomeDialog = lazy(() =>
  import('../../features/welcome/WelcomeDialog').then((m) => ({ default: m.WelcomeDialog }))
);
const IntakeDialog = lazy(() =>
  import('../../features/intake/IntakeDialog').then((m) => ({ default: m.IntakeDialog }))
);

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome());
  const [intakeFiles, setIntakeFiles] = useState<readonly File[]>([]);
  const [welcomeReturnFocus, setWelcomeReturnFocus] = useState<HTMLElement | null>(null);
  const [intakeReturnFocus, setIntakeReturnFocus] = useState<HTMLElement | null>(null);
  const chooseInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const modalOpen = welcomeOpen || intakeFiles.length > 0;

  useLayoutEffect(() => {
    setLocalWorkGuard(INTAKE_WORK_SOURCE, intakeFiles.length > 0);
    return () => setLocalWorkGuard(INTAKE_WORK_SOURCE, false);
  }, [intakeFiles.length]);

  const closeCommand = useCallback(() => setCommandOpen(false), []);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  const handleWelcomeClose = useCallback(() => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  }, []);

  const openImageIntake = useCallback(
    (files: readonly File[]) => {
      if (files.length === 0) return;
      const activeElement = document.activeElement as HTMLElement | null;
      setIntakeReturnFocus(
        welcomeOpen ? (welcomeReturnFocus ?? mainContentRef.current) : activeElement
      );
      markWelcomeSeen();
      setWelcomeOpen(false);
      setIntakeFiles([...files]);
    },
    [welcomeOpen, welcomeReturnFocus]
  );

  const intakeController = useMemo(() => ({ openImageIntake }), [openImageIntake]);

  const routeIntake = useCallback(
    (to: string, files: readonly File[]) => {
      const sessionId = createIntakeSession(files);
      setIntakeFiles([]);
      void navigate(to, { state: { sessionId } });
    },
    [navigate]
  );

  useEffect(() => {
    const handler = () => {
      setWelcomeReturnFocus(document.activeElement as HTMLElement | null);
      setCommandOpen(false);
      setNavigationOpen(false);
      setIntakeFiles([]);
      setIntakeReturnFocus(null);
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
      if (!modalOpen && (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  return (
    <ImageIntakeContext.Provider value={intakeController}>
      <div className="app-shell">
        <div
          className="app-shell__workspace"
          inert={modalOpen ? true : undefined}
          aria-hidden={modalOpen ? true : undefined}
        >
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <AppHeader
            onOpenCommand={() => setCommandOpen(true)}
            onOpenNavigation={() => setNavigationOpen(true)}
          />
          <Sidebar mobileOpen={navigationOpen} onClose={closeNavigation} />
          <main ref={mainContentRef} id="main-content" className="app-main" tabIndex={-1}>
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
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              openImageIntake(files);
            }}
          />
          <MobileNavigation
            onChoose={() => {
              const pageInput = document.querySelector<HTMLInputElement>('[data-image-input]');
              (pageInput ?? chooseInputRef.current)?.click();
            }}
            onMore={() => setNavigationOpen(true)}
          />
          <CommandPalette open={commandOpen} onClose={closeCommand} />
        </div>
        {welcomeOpen ? (
          <Suspense fallback={null}>
            <WelcomeDialog
              open
              onClose={handleWelcomeClose}
              onChooseFiles={openImageIntake}
              returnFocus={welcomeReturnFocus}
            />
          </Suspense>
        ) : null}
        {intakeFiles.length > 0 ? (
          <Suspense fallback={null}>
            <IntakeDialog
              files={intakeFiles}
              onClose={() => {
                setIntakeFiles([]);
                setIntakeReturnFocus(null);
              }}
              onSelect={routeIntake}
              returnFocus={intakeReturnFocus}
            />
          </Suspense>
        ) : null}
      </div>
    </ImageIntakeContext.Provider>
  );
}
