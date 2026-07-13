import { statusLabel } from '../event-model/status';

export const resultFilterOptions = [
  { value: 'success', label: statusLabel('success') },
  { value: 'failed', label: statusLabel('failed') },
  { value: 'unknown', label: '未知' },
];

export const businessResultFilterOptions = [
  { value: 'success', label: statusLabel('success') },
  { value: 'failed', label: statusLabel('failed') },
  { value: 'cancelled', label: statusLabel('cancelled') },
];

export const errorMechanismFilterOptions = [
  { value: 'flutter', label: 'Flutter' },
  { value: 'dart', label: 'Dart' },
  { value: 'native', label: 'Native' },
  { value: 'manual', label: '手动上报' },
  { value: 'custom', label: '自定义' },
];

export function resultFilterLabel(value?: string): string {
  if (!value) return '未知';
  return statusLabel(value) === value ? value : statusLabel(value);
}

export function mechanismFilterLabel(value?: string): string {
  return errorMechanismFilterOptions.find((option) => option.value === value)?.label ?? value ?? '-';
}

export function booleanFilterLabel(value?: boolean): string {
  if (value === undefined) return '全部';
  return value ? '是' : '否';
}
