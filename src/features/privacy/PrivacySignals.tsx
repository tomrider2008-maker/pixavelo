import { CalendarDays, Camera, Check, CircleHelp, Code2, MapPin, UserRound, X } from 'lucide-react';
import type { PrivacySignal } from './types';

const icons = {
  location: MapPin,
  camera: Camera,
  software: Code2,
  date: CalendarDays,
  author: UserRound
} as const;

export function PrivacySignals({ signals }: { readonly signals: readonly PrivacySignal[] }) {
  const presentCount = signals.filter((signal) => signal.presence === 'present').length;

  return (
    <section className="privacy-signals" aria-labelledby="privacy-signals-title">
      <div className="privacy-section-heading">
        <div>
          <span>Privacy scan</span>
          <h2 id="privacy-signals-title">Private information</h2>
        </div>
        <strong
          className={presentCount > 0 ? 'privacy-count privacy-count--warning' : 'privacy-count'}
        >
          {presentCount > 0 ? `${presentCount} signal${presentCount === 1 ? '' : 's'}` : 'Clear'}
        </strong>
      </div>
      <ul className="privacy-signal-list">
        {signals.map((signal) => {
          const Icon = icons[signal.id];
          const StateIcon =
            signal.presence === 'present' ? X : signal.presence === 'unknown' ? CircleHelp : Check;
          return (
            <li key={signal.id}>
              <span className="privacy-signal-list__icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span>
                <strong>{signal.label}</strong>
                <small title={signal.detail}>{signal.detail}</small>
              </span>
              <span className={`signal-state signal-state--${signal.presence}`}>
                <StateIcon size={13} aria-hidden="true" />
                {signal.presence === 'present'
                  ? 'Present'
                  : signal.presence === 'unknown'
                    ? 'Unknown'
                    : 'Not present'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
