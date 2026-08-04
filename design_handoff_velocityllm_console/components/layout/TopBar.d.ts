/** TopBar — sticky top bar showing the current page title and a profile menu trigger. */
export interface TopBarProps {
  title: string;
  userInitial?: string;
  userName?: string;
  onMenuClick?: () => void;
}
