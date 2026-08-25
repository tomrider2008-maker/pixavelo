import { useMemo, useState } from 'react';
import { ArrowRight, Command, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { primaryNavigation, utilityNavigation } from '../../config/navigation';
import { en } from '../../i18n/en';
import { Dialog } from '../ui/Dialog';

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const navigation = useMemo(() => [...primaryNavigation, ...utilityNavigation], []);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? navigation.filter((item) => item.label.toLocaleLowerCase().includes(normalizedQuery))
    : navigation;

  const openItem = (to: string) => {
    onClose();
    setQuery('');
    void navigate(to);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Command palette"
      description="Search Pixavelo tools and application views."
      className="command-palette"
    >
      <div className="command-palette__search">
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={en.actions.search}
          aria-label={en.actions.search}
          autoComplete="off"
        />
        <button className="icon-button icon-button--small" type="button" onClick={onClose}>
          <X size={16} />
          <span className="sr-only">{en.actions.close}</span>
        </button>
      </div>
      <div className="command-palette__meta">
        <span>Navigate</span>
        <span>
          <Command size={13} aria-hidden="true" /> K
        </span>
      </div>
      <div className="command-palette__results">
        {filtered.length > 0 ? (
          filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.to} type="button" onClick={() => openItem(item.to)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                <ArrowRight className="command-palette__arrow" size={16} aria-hidden="true" />
              </button>
            );
          })
        ) : (
          <div className="command-palette__empty">No tools match “{query}”.</div>
        )}
      </div>
    </Dialog>
  );
}
