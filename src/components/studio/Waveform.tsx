export function Waveform({ peaks }: { peaks: number[] }) {
  if (peaks.length === 0) return null;
  const width = 100;
  const height = 28;
  const mid = height / 2;
  const bar = width / peaks.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full text-ink" aria-hidden>
      {peaks.map((peak, index) => {
        const amount = Math.max(0.7, (peak || 0) * height * 0.82);
        return (
          <rect
            key={index}
            x={index * bar}
            y={mid - amount / 2}
            width={Math.max(0.12, bar * 0.62)}
            height={amount}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}
