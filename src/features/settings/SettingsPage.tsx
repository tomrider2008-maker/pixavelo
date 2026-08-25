import { MonitorCog } from 'lucide-react';
import { usePreferences, type ThemePreference } from '../../stores/preferences';

const themeOptions: readonly { readonly value: ThemePreference; readonly label: string }[] = [
  { value: 'system', label: 'Use system setting' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

export default function SettingsPage() {
  const { preferences, setReducedMotion, setSaveRecentJobs, setTheme } = usePreferences();

  return (
    <article className="content-page settings-page">
      <div className="content-page__icon" aria-hidden="true">
        <MonitorCog size={24} />
      </div>
      <h1>Settings</h1>
      <p className="content-page__lead">
        Preferences are versioned and stored only in this browser.
      </p>

      <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend>Appearance</legend>
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            value={preferences.theme}
            onChange={(event) => setTheme(event.currentTarget.value as ThemePreference)}
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={preferences.reducedMotion === 'reduce'}
              onChange={(event) =>
                setReducedMotion(event.currentTarget.checked ? 'reduce' : 'system')
              }
            />
            <span>
              <strong>Reduce motion</strong>
              <small>
                Minimize non-essential transitions in addition to your system preference.
              </small>
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Local history</legend>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={preferences.saveRecentJobs}
              onChange={(event) => setSaveRecentJobs(event.currentTarget.checked)}
            />
            <span>
              <strong>Save recent job summaries on this device</strong>
              <small>Off by default. Image binaries are never stored in recent job history.</small>
            </span>
          </label>
        </fieldset>
      </form>
    </article>
  );
}
