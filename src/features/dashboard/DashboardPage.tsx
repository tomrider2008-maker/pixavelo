import {
  ArrowRight,
  Clock3,
  Eraser,
  FileImage,
  Gauge,
  Globe2,
  ImageDown,
  Images,
  Layers3,
  LocateOff,
  Maximize2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { useImageIntake } from '../intake/IntakeContext';

const quickActions = [
  {
    label: 'HEIC → JPG',
    to: '/convert?from=heic&to=jpeg',
    icon: FileImage
  },
  { label: 'PNG → JPG', to: '/convert?from=png&to=jpeg', icon: Images },
  { label: 'JPG → WebP', to: '/convert?from=jpeg&to=webp', icon: Sparkles },
  { label: 'Image under 500 KB', to: '/optimize?preset=500kb', icon: Gauge },
  { label: 'Resize to 1920px', to: '/resize?preset=1920', icon: Maximize2 },
  { label: 'Remove GPS', to: '/privacy?action=remove-gps', icon: LocateOff }
] as const;

const workflows = [
  {
    title: 'Convert Images',
    description: 'Import core and advanced formats; export JPG, PNG or WebP',
    to: '/convert',
    icon: Sparkles
  },
  {
    title: 'Compress Images',
    description: 'Reduce file size with smart compression',
    to: '/optimize',
    icon: Gauge
  },
  {
    title: 'Resize Images',
    description: 'Change dimensions and scale images',
    to: '/resize',
    icon: ImageDown
  },
  {
    title: 'Batch Studio',
    description: 'Process many images with preset workflows',
    to: '/batch',
    icon: Layers3
  },
  {
    title: 'Metadata Cleaner',
    description: 'Remove EXIF, GPS and other metadata',
    to: '/privacy',
    icon: Eraser
  },
  {
    title: 'Web Asset Generator',
    description: 'Create responsive images for the web',
    to: '/web-assets',
    icon: Globe2
  }
] as const;

export default function DashboardPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { openImageIntake } = useImageIntake();

  const openFiles = useCallback(
    (files: FileList | readonly File[]) => {
      const selected = Array.from(files);
      if (selected.length === 0) return;
      openImageIntake(selected);
    },
    [openImageIntake]
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    openFiles(event.dataTransfer.files);
  };

  return (
    <div className="dashboard-page">
      <section className="dashboard-intro" aria-labelledby="dashboard-title">
        <h1 id="dashboard-title">{en.app.tagline}</h1>
        <p>{en.app.introduction}</p>
        <div className="dashboard-intro__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Images size={19} aria-hidden="true" />
            {en.actions.chooseImages}
          </button>
        </div>
        <div className="privacy-line">
          <ShieldCheck size={18} aria-hidden="true" />
          {en.app.privacyLine}
        </div>
        <input
          ref={inputRef}
          data-image-input
          className="sr-only"
          type="file"
          aria-label="Choose image files"
          accept="image/*,.jfif,.heic,.heif,.tif,.tiff,.ico"
          multiple
          onChange={(event) => openFiles(event.currentTarget.files ?? [])}
        />
      </section>

      <aside className="quick-actions" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title">{en.dashboard.quickActionsTitle}</h2>
        <div className="quick-actions__list">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} to={action.to}>
                <Icon size={19} strokeWidth={1.65} aria-hidden="true" />
                <span className="quick-action__copy">
                  <span>{action.label}</span>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </aside>

      <div
        className={`drop-zone${dragging ? ' drop-zone--dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Choose or drop image files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        onPaste={(event) => openFiles(event.clipboardData.files)}
      >
        <div className="drop-zone__corners" aria-hidden="true" />
        <FileImage size={48} strokeWidth={1.35} aria-hidden="true" />
        <strong>{dragging ? 'Release to add images' : en.dashboard.dropTitle}</strong>
        <span className="desktop-drop-hint">{en.dashboard.dropHint}</span>
        <span className="mobile-drop-hint">{en.dashboard.mobileDropHint}</span>
        <span className="drop-zone__trust">
          <ShieldCheck size={15} aria-hidden="true" />
          Files never leave this device.
        </span>
      </div>

      <section className="workflows" aria-labelledby="workflows-title">
        <h2 id="workflows-title">{en.dashboard.workflowTitle}</h2>
        <div className="workflows__list">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Link key={workflow.title} to={workflow.to} className="workflow-row">
                <span className="workflow-row__icon">
                  <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="workflow-row__copy">
                  <strong>{workflow.title}</strong>
                  <small>{workflow.description}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="recent-jobs" aria-labelledby="recent-jobs-title">
        <h2 id="recent-jobs-title">{en.dashboard.recentTitle}</h2>
        <div className="recent-jobs__empty">
          <Clock3 size={25} strokeWidth={1.6} aria-hidden="true" />
          <span>{en.dashboard.recentEmpty}</span>
          <small>{en.dashboard.recentNote}</small>
        </div>
      </section>
    </div>
  );
}
