import { Braces, Camera, FileSearch, MapPin } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { MetadataInspection, MetadataSection } from './types';

const sections: readonly {
  id: MetadataSection;
  label: string;
  icon: typeof FileSearch;
}[] = [
  { id: 'general', label: 'General', icon: FileSearch },
  { id: 'exif', label: 'EXIF', icon: Camera },
  { id: 'gps', label: 'GPS', icon: MapPin },
  { id: 'other', label: 'Other', icon: Braces }
];

export function MetadataTable({
  inspection,
  activeSection,
  onSectionChange
}: {
  readonly inspection: MetadataInspection;
  readonly activeSection: MetadataSection;
  readonly onSectionChange: (section: MetadataSection) => void;
}) {
  const fields = inspection[activeSection];

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = sections.findIndex((section) => section.id === activeSection);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? sections.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length;
    const section = sections[next];
    if (!section) return;
    onSectionChange(section.id);
    document.getElementById(`metadata-${section.id}-tab`)?.focus();
  };

  return (
    <section className="metadata-browser" aria-labelledby="metadata-browser-title">
      <div className="privacy-section-heading">
        <div>
          <span>Source evidence</span>
          <h2 id="metadata-browser-title">Metadata inspector</h2>
        </div>
        <strong>
          {inspection.metadataBytes > 0 ? 'Metadata found' : 'No container blocks found'}
        </strong>
      </div>

      <div className="metadata-tabs" role="tablist" aria-label="Metadata sections">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              id={`metadata-${section.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              aria-controls="metadata-fields-panel"
              tabIndex={activeSection === section.id ? 0 : -1}
              onClick={() => onSectionChange(section.id)}
              onKeyDown={onTabKeyDown}
            >
              <Icon size={15} aria-hidden="true" /> {section.label}
            </button>
          );
        })}
      </div>

      <div
        id="metadata-fields-panel"
        className="metadata-fields"
        role="tabpanel"
        aria-labelledby={`metadata-${activeSection}-tab`}
      >
        {fields.length > 0 ? (
          <dl>
            {fields.map((field) => (
              <div key={field.id}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="metadata-fields__empty">
            <FileSearch size={20} aria-hidden="true" />
            <strong>No readable {activeSection.toUpperCase()} fields</strong>
            <span>Pixavelo reports absence only for fields its bounded parser can verify.</span>
          </div>
        )}
      </div>
    </section>
  );
}
