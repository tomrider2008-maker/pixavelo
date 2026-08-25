import { CircleHelp, Menu, Moon, Search, ShieldCheck, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { usePreferences } from '../../stores/preferences';
import { PixaveloLogo } from '../brand/PixaveloLogo';

interface AppHeaderProps {
  readonly onOpenCommand: () => void;
  readonly onOpenNavigation: () => void;
}

export function AppHeader({ onOpenCommand, onOpenNavigation }: AppHeaderProps) {
  const { resolvedTheme, setTheme } = usePreferences();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <header className="app-header">
      <Link className="app-header__brand" to="/" aria-label="Pixavelo dashboard">
        <PixaveloLogo />
      </Link>

      <button className="search-trigger" type="button" onClick={onOpenCommand}>
        <Search size={18} aria-hidden="true" />
        <span>{en.actions.search}</span>
        <kbd>⌘ K</kbd>
      </button>

      <div className="app-header__actions">
        <div className="local-status" title="Image files stay on this device">
          <ShieldCheck size={18} aria-hidden="true" />
          <span className="local-status__dot" aria-hidden="true" />
          <span>{en.status.localProcessing}</span>
        </div>
        <button
          className="icon-button app-header__theme"
          type="button"
          aria-label={`Use ${nextTheme} theme`}
          onClick={() => setTheme(nextTheme)}
        >
          {resolvedTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button
          className="icon-button app-header__mobile-search"
          type="button"
          aria-label="Search tools and actions"
          onClick={onOpenCommand}
        >
          <Search size={21} />
        </button>
        <Link className="icon-button app-header__help" to="/help" aria-label="Help">
          <CircleHelp size={20} />
        </Link>
        <button
          className="icon-button app-header__menu"
          type="button"
          aria-label="Open navigation"
          onClick={onOpenNavigation}
        >
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}
