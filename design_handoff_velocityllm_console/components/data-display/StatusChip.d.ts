/** StatusChip — colored pill for live system/request status (success/error/warning/info/default). */
export interface StatusChipProps {
  label: string;
  status?: 'success' | 'error' | 'warning' | 'info' | 'default';
  size?: 'small' | 'medium';
}
