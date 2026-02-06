import type { CSSProperties } from "react";
import type { ReactNode } from "react";

type BarRow = {
  label: string;
  valueText: string;
  value: number;
  color?: string; // CSS color (e.g. "var(--fsk-12)")
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function barPctLinear(value: number, max: number): number {
  if (max <= 0) return 0;
  return clamp01(value / max);
}

function barPctLog(value: number, max: number): number {
  if (max <= 0) return 0;
  // +1 verhindert log(0) und glättet starke Unterschiede
  const v = Math.log10(Math.max(0, value) + 1);
  const m = Math.log10(max + 1);
  return m <= 0 ? 0 : clamp01(v / m);
}

function BarList({
  title,
  subtitle,
  rows,
  scale = "linear",
}: {
  title: string;
  subtitle?: ReactNode;
  rows: BarRow[];
  scale?: "linear" | "log";
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  const pctFn = scale === "log" ? barPctLog : barPctLinear;

  return (
    <section className="rounded-xl border border-ring bg-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text">{title}</h3>
          {subtitle ? (
            <div className="mt-1 text-sm text-text/60">{subtitle}</div>
          ) : null}
        </div>
        <div className="text-xs text-text/50">
          {scale === "log" ? "log" : "linear"}
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {rows.map((r) => {
          const pct = pctFn(r.value, max);
          const fillStyle: CSSProperties = {
            width: `${(pct * 100).toFixed(2)}%`,
            background: r.color ?? "var(--accent)",
          };
          return (
            <li key={r.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-text/80">{r.label}</span>
                <span className="text-sm font-medium text-text">
                  {r.valueText}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg/60 border border-ring overflow-hidden">
                <div className="h-full rounded-full" style={fillStyle} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function fskColor(label: string): string {
  if (label.includes("FSK 0")) return "var(--fsk-0)";
  if (label.includes("FSK 6")) return "var(--fsk-6)";
  if (label.includes("FSK 12")) return "var(--fsk-12)";
  if (label.includes("FSK 16")) return "var(--fsk-16)";
  if (label.includes("FSK 18")) return "var(--fsk-18)";
  return "var(--ring)";
}

function formatGiB(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0 GB";
  if (v >= 1000) return `${(v / 1000).toFixed(2)} TB`;
  if (v >= 1) return `${v.toFixed(2)} GB`;
  if (v >= 0.1) return `${Math.round(v * 1000)} MB`;
  return `${v.toFixed(3)} GB`;
}

export function StatsCharts({
  fskLabels,
  fskCounts,
  mediaLabels,
  mediaCounts,
  mediaSavedGiB,
}: {
  fskLabels: string[];
  fskCounts: number[];
  mediaLabels: string[];
  mediaCounts: number[];
  mediaSavedGiB: number[];
}) {
  const fskRows: BarRow[] = fskLabels.map((label, i) => ({
    label,
    value: fskCounts[i] ?? 0,
    valueText: String(fskCounts[i] ?? 0),
    color: fskColor(label),
  }));

  const mediaCountRows: BarRow[] = mediaLabels.map((label, i) => ({
    label,
    value: mediaCounts[i] ?? 0,
    valueText: `${mediaCounts[i] ?? 0} Filme`,
    color: "var(--accent)",
  }));

  const mediaSavedRows: BarRow[] = mediaLabels.map((label, i) => ({
    label,
    value: mediaSavedGiB[i] ?? 0,
    valueText: formatGiB(mediaSavedGiB[i] ?? 0),
    color: "rgba(34,197,94,1)", // tailwind green-500
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BarList
        title="FSK-Verteilung"
        subtitle={
          <div className="space-y-1">
            <p>Anzahl Filme pro FSK.</p>
            <p>
              <span className="font-medium text-text/70">Unbekannt</span>: Filme
              mit Status{" "}
              <span className="font-medium text-text/70">
                VÖ: Unbekannt
              </span>{" "}
              oder{" "}
              <span className="font-medium text-text/70">
                VÖ: Demnächst
              </span>{" "}
              (noch nicht veröffentlicht).
            </p>
          </div>
        }
        rows={fskRows}
        scale="log"
      />
      <BarList
        title="Filme nach Medientyp"
        subtitle="Log-Skalierung für bessere Vergleichbarkeit."
        rows={mediaCountRows}
        scale="log"
      />
      <div className="lg:col-span-2">
        <BarList
          title="Ersparnis nach Medientyp"
          subtitle="Gesamtersparnis je Medientyp."
          rows={mediaSavedRows}
          scale="log"
        />
      </div>
    </div>
  );
}

