/** Tabs — small segmented control for switching between views. */
export interface TabItem { value: string; label: string; }
export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange?: (value: string) => void;
}
