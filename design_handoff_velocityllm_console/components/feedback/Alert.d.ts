/** Alert — inline informational/error banner with optional icon and title. */
export interface AlertProps {
  variant?: 'default' | 'destructive';
  icon?: React.ReactNode;
  title?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
