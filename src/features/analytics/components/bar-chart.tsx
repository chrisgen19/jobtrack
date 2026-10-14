/**
 * Single-series vertical bar chart (applications over time). One hue,
 * rounded data ends on a shared baseline, 2px gaps, a value label on
 * non-zero bars and a native tooltip per bar. The same numbers are listed in
 * a visually hidden table for screen readers.
 */
export function BarChart({
  data,
  label,
}: {
  data: { key: string; label: string; value: number }[];
  label: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const showEvery = Math.ceil(data.length / 12);
  return (
    <figure className="mt-5">
      <div className="flex h-[193px] items-end gap-0.5 border-b border-[#e4ebe5] px-1" aria-hidden>
        {data.map((item) => (
          <div
            key={item.key}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${item.label}: ${item.value}`}
          >
            {item.value > 0 ? (
              <span className="mb-1 text-[9px] font-bold text-[#496657]">{item.value}</span>
            ) : null}
            <div
              className="w-full max-w-[38px] rounded-t-[4px] bg-[#1d7657] transition-opacity group-hover:opacity-80"
              style={{ height: item.value === 0 ? 0 : `${Math.max(4, (item.value / max) * 82)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-0.5 px-1" aria-hidden>
        {data.map((item, index) => (
          <span
            key={item.key}
            className="min-w-0 flex-1 overflow-visible text-center text-[9px] whitespace-nowrap text-[#9daaa0]"
          >
            {index % showEvery === 0 ? item.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Period starting</th>
            <th scope="col">Applications</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.key}>
              <td>{item.label}</td>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Labeled horizontal bars (funnel, stage distribution). Values are text, not color. */
export function HorizontalBars({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  const max = Math.max(1, total);
  return (
    <dl className="mt-5 flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3.5">
          <dt className="w-[118px] flex-none truncate text-[11px] text-[#728579]">{row.label}</dt>
          <dd className="flex flex-1 items-center gap-3">
            <span className="h-[9px] flex-1 overflow-hidden rounded-md bg-[#f0f4ef]" aria-hidden>
              <span
                className="block h-full rounded-md bg-[#5aa986]"
                style={{ width: `${(100 * row.value) / max}%` }}
              />
            </span>
            <strong className="w-7 text-right text-[11px] text-[#496657]">{row.value}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}
