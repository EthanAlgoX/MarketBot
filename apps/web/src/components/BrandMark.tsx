/** The project's market mark; colors follow the surrounding semantic foreground. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false" className={className}>
      <rect x="120" y="270" width="48" height="120" rx="12" fill="currentColor" />
      <rect x="232" y="198" width="48" height="192" rx="12" fill="currentColor" />
      <rect x="344" y="126" width="48" height="264" rx="12" fill="currentColor" />
    </svg>
  );
}
