export interface ResourceFieldProps {
  label: string;
  value: number;
  options: readonly number[];
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}
