/**
 * Select — dropdown for choosing one option from a list.
 */
export interface SelectOption {
  value: string;
  label: string;
}
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
