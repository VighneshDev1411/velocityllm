/**
 * Button — the product's primary interactive control (shadcn-style variants).
 */
export interface ButtonProps {
  /** Visual style. Default 'default' (solid primary). */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  /** Control height/padding. Default 'default'. 'icon' is a 36x36 square. */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
