import { Menu, Plus } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { mobileNavigation } from '../../config/navigation';

interface MobileNavigationProps {
  readonly onChoose: () => void;
  readonly onMore: () => void;
}

export function MobileNavigation({ onChoose, onMore }: MobileNavigationProps) {
  const location = useLocation();
  const moreActive = !mobileNavigation.some((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  return (
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      {mobileNavigation.slice(0, 2).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            {...(item.end === undefined ? {} : { end: item.end })}
          >
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
      <button className="mobile-navigation__choose" type="button" onClick={onChoose}>
        <span>
          <Plus size={25} aria-hidden="true" />
        </span>
        Choose
      </button>
      {mobileNavigation.slice(2).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to}>
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label.replace(' Studio', '')}</span>
          </NavLink>
        );
      })}
      <button
        className={moreActive ? 'active' : undefined}
        type="button"
        aria-current={moreActive ? 'page' : undefined}
        onClick={onMore}
      >
        <Menu size={21} strokeWidth={1.8} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
