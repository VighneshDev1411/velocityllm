/** Sidebar — collapsible left navigation rail with grouped link sections. */
export interface SidebarLink {
  href: string;
  label: string;
  /** Lucide icon name. */
  icon: string;
}
export interface SidebarSection {
  title?: string;
  links: SidebarLink[];
}
export interface SidebarProps {
  sections: SidebarSection[];
  activeHref?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLinkClick?: (href: string) => void;
  brand?: string;
}
