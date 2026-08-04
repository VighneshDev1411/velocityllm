/** Badge — small pill for status/tags/counts. */
export interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
