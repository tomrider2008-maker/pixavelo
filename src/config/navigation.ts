import {
  CircleHelp,
  Code2,
  Gauge,
  ImageDown,
  LayoutDashboard,
  Layers3,
  Pencil,
  Settings,
  Shield,
  Sparkles,
  type LucideIcon
} from 'lucide-react';

export interface NavigationItem {
  readonly label: string;
  readonly to: string;
  readonly icon: LucideIcon;
  readonly end?: boolean;
  readonly shortcut?: string;
}

export const primaryNavigation: readonly NavigationItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true, shortcut: 'D' },
  { label: 'Convert', to: '/convert', icon: Sparkles, shortcut: 'C' },
  { label: 'Optimize', to: '/optimize', icon: Gauge, shortcut: 'O' },
  { label: 'Resize', to: '/resize', icon: ImageDown, shortcut: 'R' },
  { label: 'Batch Studio', to: '/batch', icon: Layers3, shortcut: 'B' },
  { label: 'Edit', to: '/edit', icon: Pencil },
  { label: 'Privacy', to: '/privacy', icon: Shield, shortcut: 'P' },
  { label: 'Web Assets', to: '/web-assets', icon: ImageDown },
  { label: 'Developer Tools', to: '/developer-tools', icon: Code2 }
];

export const utilityNavigation: readonly NavigationItem[] = [
  { label: 'Settings', to: '/settings', icon: Settings },
  { label: 'Help', to: '/help', icon: CircleHelp }
];

export const mobileNavigation: readonly NavigationItem[] = [
  primaryNavigation[0],
  primaryNavigation[1],
  primaryNavigation[5],
  primaryNavigation[6]
].filter((item): item is NavigationItem => item !== undefined);
