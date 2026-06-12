export function JsonViewer({ value, className = '' }: { value: unknown; className?: string }) {
  return (
    <pre className={`h-full max-h-full overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100 ${className}`}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
