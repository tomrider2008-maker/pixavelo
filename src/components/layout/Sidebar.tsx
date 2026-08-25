import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { primaryNavigation, utilityNavigation, type NavigationItem } from '../../config/navigation';

interface SidebarProps {
  readonly mobileOpen: boolean;
  readonly onClose: () => void;
}

function NavigationLink({
  item,
  onClick
}: {
  readonly item: NavigationItem;
  readonly onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      {...(item.end === undefined ? {} : { end: item.end })}
      onClick={onClick}
      className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <button
        className={`navigation-scrim${mobileOpen ? ' navigation-scrim--visible' : ''}`}
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside
        className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar__mobile-head">
          <strong>Navigation</strong>
          <button className="icon-button icon-button--small" type="button" onClick={onClose}>
            <X size={18} />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>
        <nav className="sidebar__primary">
          {primaryNavigation.map((item) => (
            <NavigationLink key={item.to} item={item} onClick={onClose} />
          ))}
        </nav>
        <nav className="sidebar__utility" aria-label="Support and settings">
          {utilityNavigation.map((item) => (
            <NavigationLink key={item.to} item={item} onClick={onClose} />
          ))}
        </nav>
      </aside>
    </>
  );
}
