'use client';

export type Bar = { label: string; value: number };

export default function BarChart({
  data,
  height = 140,
  accent = '#0f6e56',
}: {
  data: Bar[];
  height?: number;
  accent?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / Math.max(data.length, 1);

  if (data.length === 0) {
    return (
      <div className="border border-earn-gray-300 p-4 text-center font-mono text-[10px] uppercase text-earn-gray-500">
        No data yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 24);
          const x = i * barWidth + barWidth * 0.1;
          const y = height - h - 18;
          const w = barWidth * 0.8;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill={accent} opacity={0.85} />
              <text
                x={x + w / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={5}
                fontFamily="Space Mono, monospace"
                fill="#0b0b0b"
              >
                {d.value}
              </text>
              <text
                x={x + w / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize={4.5}
                fontFamily="Space Mono, monospace"
                fill="#5c5c5c"
              >
                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
