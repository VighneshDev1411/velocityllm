/** StatCard — dashboard KPI tile with icon, mono value, and colored accent border. */
export interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'green' | 'purple' | 'red' | 'orange';
  style?: React.CSSProperties;
}
