export interface CanfarRangeProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  marks?: Array<{ value: number }>;
  onChange: (value: number) => void;
  onChangeCommitted?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  valueText?: string;
  valueMin?: number;
  valueMax?: number;
  valueNow?: number;
}
