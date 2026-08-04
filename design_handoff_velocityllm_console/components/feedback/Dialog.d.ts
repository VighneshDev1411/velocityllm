/** Dialog — centered modal with overlay, title/description, body, and footer actions. */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}
