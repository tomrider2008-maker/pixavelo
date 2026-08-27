import {
  ArrowRight,
  Blocks,
  Braces,
  Crop,
  Globe2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserX,
  WifiOff,
  X,
  Zap
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from 'react';
import { Link } from 'react-router-dom';

interface WelcomeDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

const studios = [
  {
    id: 'edit',
    label: 'Image Editor',
    icon: Sparkles,
    description: 'Non-destructive adjustments, crop, rotate, and transform with pixel precision.',
    to: '/edit'
  },
  {
    id: 'convert',
    label: 'Convert & Optimize',
    icon: Zap,
    description: 'Convert between formats and compress for web or archival — all locally.',
    to: '/convert'
  },
  {
    id: 'resize',
    label: 'Resize & Transform',
    icon: Crop,
    description: 'Exact dimensions, percentages, social presets, and smart trim in one place.',
    to: '/resize'
  },
  {
    id: 'batch',
    label: 'Batch Processing',
    icon: Layers3,
    description: 'Apply multi-step recipes to hundreds of images without cloud infrastructure.',
    to: '/batch'
  },
  {
    id: 'web-assets',
    label: 'Web Assets',
    icon: Globe2,
    description: 'Generate responsive image sets, favicons, and app icons from a single source.',
    to: '/web-assets'
  },
  {
    id: 'developer-tools',
    label: 'Developer Tools',
    icon: Braces,
    description: 'Sprite sheets, watermarks, frame extraction, hash verification, and presets.',
    to: '/developer-tools'
  }
] as const;

const privacyProofs = [
  { icon: LockKeyhole, label: 'Local processing' },
  { icon: ShieldCheck, label: 'No image uploads' },
  { icon: UserX, label: 'No account required' },
  { icon: WifiOff, label: 'No tracking' }
] as const;

const capabilities = [
  { icon: Sparkles, label: 'Premium editing and transformations' },
  { icon: Blocks, label: 'Modern formats — WebP, AVIF, HEIC, TIFF' },
  { icon: Layers3, label: 'Batch workflows with preset recipes' },
  { icon: Globe2, label: 'Responsive web asset generation' },
  { icon: ShieldCheck, label: 'Private, browser-native processing' }
] as const;

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.closest('[aria-hidden="true"]'));
}

export function WelcomeDialog({ open, onClose }: WelcomeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const studiosRef = useRef<HTMLElement>(null);

  // Scroll-lock body while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Focus first element on open
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Return focus to trigger when closing — not needed here since dialog
  // opens on first visit before any user action.

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = focusableElements(dialog);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const scrollToStudios = useCallback(() => {
    studiosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstStudio = studiosRef.current?.querySelector<HTMLElement>('a, button');
    firstStudio?.focus({ preventScroll: true });
  }, []);

  if (!open) return null;

  return (
    <div
      className="welcome-backdrop"
      role="presentation"
      aria-hidden="false"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="welcome-dialog"
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          type="button"
          className="welcome-close"
          aria-label="Close welcome guide"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="welcome-scroll">
          {/* Hero */}
          <header className="welcome-hero" aria-labelledby="welcome-title">
            <div className="welcome-wordmark" aria-hidden="true">
              <WelcomeWordmark />
            </div>
            <h1 id="welcome-title" className="welcome-headline">
              Your private image studio.
            </h1>
            <p className="welcome-subtext">
              Professional image tools that run entirely in your browser — no servers, no accounts,
              no uploads.
            </p>
            <div className="welcome-hero__actions">
              <button
                type="button"
                className="button button--primary welcome-cta"
                onClick={onClose}
              >
                Start creating
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="button button--secondary" onClick={scrollToStudios}>
                Explore the studios
              </button>
            </div>
          </header>

          {/* Privacy proof */}
          <section className="welcome-privacy" aria-label="Privacy guarantees">
            {privacyProofs.map(({ icon: Icon, label }) => (
              <div key={label} className="welcome-privacy__badge">
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </section>

          {/* Studios */}
          <section
            ref={studiosRef}
            className="welcome-studios"
            aria-labelledby="welcome-studios-title"
          >
            <h2 id="welcome-studios-title" className="welcome-section-title">
              Six studios. One browser tab.
            </h2>
            <div className="welcome-studios__grid">
              {studios.map(({ id, label, icon: Icon, description, to }) => (
                <Link key={id} to={to} className="welcome-studio-card" onClick={onClose}>
                  <span className="welcome-studio-card__icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.65} />
                  </span>
                  <span className="welcome-studio-card__body">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowRight size={14} className="welcome-studio-card__arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          {/* Capability highlights */}
          <section className="welcome-capabilities" aria-labelledby="welcome-cap-title">
            <h2 id="welcome-cap-title" className="welcome-section-title">
              Built for serious image work.
            </h2>
            <ul className="welcome-capabilities__list" role="list">
              {capabilities.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Trust footer */}
          <footer className="welcome-trust">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              Every file you open is processed using your browser&rsquo;s compute power. Nothing
              leaves your device. There are no servers involved.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function WelcomeWordmark(): ReactNode {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="6" y="6" width="20" height="20" rx="4" fill="var(--color-surface)" />
      <rect x="10" y="10" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}
