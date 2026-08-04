/** Toast — transient floating notification card. */
export interface ToastProps {
  variant?: 'default' | 'success' | 'error' | 'warning';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
