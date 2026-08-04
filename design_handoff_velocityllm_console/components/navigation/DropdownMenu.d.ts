/** DropdownMenu — click-triggered floating menu (profile menus, row actions). */
export interface DropdownMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  separator?: boolean;
}
export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'end';
}
