/**
 * Icon — renders a Lucide icon by name.
 */
export interface IconProps {
  /** Lucide icon name, kebab-case, e.g. "zap", "activity", "chevron-down". */
  name: string;
  /** Pixel size (square). Default 18. */
  size?: number;
  /** CSS color. Default currentColor. */
  color?: string;
  /** Stroke width passed through to the Lucide SVG. Default 2. */
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}
