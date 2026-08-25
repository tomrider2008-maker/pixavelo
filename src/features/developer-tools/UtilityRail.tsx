import {
  Bookmark,
  Braces,
  Calculator,
  Film,
  Grid2X2,
  Hash,
  Droplet,
  type LucideIcon
} from 'lucide-react';
import type { ProfessionalUtilityMode } from './types';

const utilities: readonly {
  id: ProfessionalUtilityMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'watermark', label: 'Watermark', icon: Droplet },
  { id: 'frames', label: 'Frames', icon: Film },
  { id: 'base64', label: 'Base64', icon: Braces },
  { id: 'hash', label: 'Hash', icon: Hash },
  { id: 'sprite', label: 'Sprite sheet', icon: Grid2X2 },
  { id: 'calculators', label: 'Calculators', icon: Calculator },
  { id: 'presets', label: 'Presets', icon: Bookmark }
];

export function UtilityRail({
  mode,
  onChange
}: {
  readonly mode: ProfessionalUtilityMode;
  readonly onChange: (mode: ProfessionalUtilityMode) => void;
}) {
  return (
    <div className="utility-rail" role="tablist" aria-label="Professional utility">
      {utilities.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
        >
          <Icon size={17} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}
