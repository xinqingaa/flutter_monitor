export function statusLabel(status?: string): string {
  if (!status) return '正常';
  const labels: Record<string, string> = {
    ok: '正常',
    success: '成功',
    error: '异常',
    failed: '失败',
    warning: '警告',
    pending: '处理中',
  };
  return labels[status] ?? status;
}
