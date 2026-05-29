export function JsonViewer({ value }: { value: unknown }) {
  return (
    <pre className="h-full max-h-full overflow-auto rounded-md bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
