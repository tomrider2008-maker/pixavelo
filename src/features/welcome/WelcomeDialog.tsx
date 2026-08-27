import { ArrowRight, LockKeyhole, ShieldCheck, UserX, WifiOff, X } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { PixaveloLogo } from '../../components/brand/PixaveloLogo';
import { Dialog } from '../../components/ui/Dialog';
import { primaryNavigation } from '../../config/navigation';

interface WelcomeDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onChooseFiles: (files: readonly File[]) => void;
  readonly returnFocus?: HTMLElement | null;
}

const studioOrder = ['/edit', '/convert', '/optimize', '/resize', '/batch', '/web-assets'] as const;
const studioDescriptions: Record<(typeof studioOrder)[number], string> = {
  '/edit': 'Adjust, crop, transform and compare.',
  '/convert': 'Change format with precise output control.',
  '/optimize': 'Reduce size while protecting fidelity.',
  '/resize': 'Fit exact dimensions and platform presets.',
  '/batch': 'Run one trusted recipe across many files.',
  '/web-assets': 'Build responsive images, icons and markup.'
};

const studios = studioOrder.flatMap((to) => {
  const item = primaryNavigation.find((candidate) => candidate.to === to);
  return item ? [{ ...item, description: studioDescriptions[to] }] : [];
});

const privacyProofs = [
  { icon: LockKeyhole, label: 'Local processing' },
  { icon: ShieldCheck, label: 'No uploads' },
  { icon: UserX, label: 'No account' },
  { icon: WifiOff, label: 'No tracking' }
] as const;

export function WelcomeDialog({ open, onClose, onChooseFiles, returnFocus }: WelcomeDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) onChooseFiles(files);
  };

  return (
    <Dialog
      open={open}
      title="Welcome to Pixavelo"
      description="Choose images or open a private, browser-based image studio."
      onClose={onClose}
      className="welcome-dialog premium-dialog-panel"
      backdropClassName="welcome-backdrop premium-dialog-backdrop"
      returnFocus={returnFocus}
    >
      <header className="welcome-topbar premium-dialog-header">
        <PixaveloLogo compact />
        <button
          type="button"
          className="icon-button welcome-close"
          aria-label="Close welcome guide"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="welcome-layout">
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div>
            <h1 id="welcome-title">Your private image studio.</h1>
            <p>
              Edit, convert, optimize and prepare images without sending a single file to a server.
            </p>
          </div>
          <div className="welcome-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => inputRef.current?.click()}
            >
              Choose images
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="button button--secondary" onClick={onClose}>
              Continue to dashboard
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/*,.jfif,.heic,.heif,.tif,.tiff,.ico"
              multiple
              tabIndex={-1}
              aria-label="Choose image files"
              onChange={handleFiles}
            />
          </div>
          <div className="welcome-privacy" aria-label="Privacy guarantees">
            {privacyProofs.map(({ icon: Icon, label }) => (
              <span key={label}>
                <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="welcome-studios" aria-labelledby="welcome-studios-title">
          <h2 id="welcome-studios-title">Choose a studio</h2>
          <div className="welcome-studios__grid studio-grid">
            {studios.map(({ label, icon: Icon, description, to }) => (
              <Link key={to} to={to} className="welcome-studio-card studio-card" onClick={onClose}>
                <span className="studio-card__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.65} />
                </span>
                <span className="studio-card__copy">
                  <strong>{label}</strong>
                  <small className="studio-card__description">{description}</small>
                </span>
                <ArrowRight className="studio-card__arrow" size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="welcome-trust premium-dialog-trust">
        <ShieldCheck size={17} aria-hidden="true" />
        <strong>Your files stay on this device.</strong>
        <span>No server receives or processes your image files.</span>
      </footer>
    </Dialog>
  );
}
