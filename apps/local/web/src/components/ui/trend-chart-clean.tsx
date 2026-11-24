// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/*
 * Trend Chart (clean style) – the chart on its own, to drop into any card, KPI tile or table row. One self-contained file.
 *   · four variants from the same data: line, area, bar and a small sparkline without axes
 *   · a series marked `previous` is drawn quieter – dashed as a line, faint as a bar – for "this period against the last"
 *   · hover, touch or the arrow keys open a tooltip with every series at that point
 *   · new data glides in: lines and bars ease from where they were to where they belong, the axis follows
 *   · `index` + `onIndexChange` let several charts share one point, so a row of cards reads the same day together
 * No chart library – plain SVG and a few positioned elements. The styles are injected below, so no extra files are needed.
 */

export type TrendSeries = {
  label: string;
  /** One value per label, same length as `labels`; null (or NaN) leaves a gap */
  values: (number | null)[];
  /** Any CSS color – falls back to the palette (blue, purple, teal, amber, pink, green), or gray for a previous series */
  color?: string;
  /** The period before: a dashed line, a faint bar, no fill */
  previous?: boolean;
};

export type TrendChartProps = {
  /** Short labels along the x-axis, e.g. "Mar 4" */
  labels: string[];
  /** Longer labels for the tooltip header, e.g. "Tue, Mar 4" – falls back to `labels` */
  tooltipLabels?: string[];
  series: TrendSeries[];
  variant?: "line" | "area" | "bar" | "sparkline";
  /** Formats the tooltip values – and the axis, unless `axisFormat` is set */
  format?: (n: number) => string;
  /** Shorter numbers for the axis, e.g. "$1.6T" while the tooltip shows "$1,600,000,000,000.00" */
  axisFormat?: (n: number) => string;
  /** Height of the plot in px – 152 by default, 40 for a sparkline */
  height?: number;
  /** Value labels on the left and dates below (true), only the dates ("x"), or none (false) – both by default, none for a sparkline */
  axis?: boolean | "x";
  /** The popover or tag with the values – turn it off when the card shows the value itself; the point is still marked */
  tooltip?: boolean;
  /** Start the value axis at zero (default). false zooms in around the values – for averages and rates; bars always start at zero */
  zero?: boolean;
  /** The highlighted point, controlled – pass null for none. Leave undefined to let the chart handle it */
  index?: number | null;
  /** Called when the pointer or the keys move to another point, or leave (null) */
  onIndexChange?: (index: number | null) => void;
  /** Point that stays highlighted while nobody hovers */
  defaultIndex?: number;
  /** Name for screen readers, e.g. "Spend per day" */
  label?: string;
  /** Quiet text in the plot when there is nothing to draw */
  emptyText?: string;
  className?: string;
};

const PALETTE = [
  "var(--aui-blue, #0190fe)",
  "var(--aui-purple, #a651f0)",
  "var(--aui-teal, #13b3a0)",
  "var(--aui-amber, #e8b000)",
  "var(--aui-pink, #ee3e9e)",
  "var(--aui-green, #5fc88a)",
];

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - (1 - t) ** 4;

/** 0.0004 → "0.0004", 4200 → "4.2k", 12,345,678 → "12M" */
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e12) return `${+(n / 1e12).toFixed(a >= 1e13 ? 0 : 1)}T`;
  if (a >= 1e9) return `${+(n / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1000) return `${+(n / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  if (a > 0 && a < 1) return `${+n.toPrecision(2)}`;
  return `${Math.round(n)}`;
};

/** A formatter that throws or returns nothing still gives readable text */
const safe = (format: (n: number) => string, n: number) => {
  try {
    const s = format(n);
    return s == null || s === "" ? compact(n) : String(s);
  } catch {
    return compact(n);
  }
};

/** Rounds the top of the axis up to a value that halves cleanly: 30 → 15 → 0, $8k → $4k → $0 */
function niceMax(max: number) {
  if (!finite(max) || max <= 0) return 1;
  const half = max / 2;
  const pow = 10 ** Math.floor(Math.log10(half));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * pow >= half) ?? 10;
  return step * pow * 2;
}

/** A zoomed axis: a little room around the values, cut at round steps, never below zero for positive data */
function niceRange(lo: number, hi: number): [number, number] {
  const span = hi - lo || Math.abs(hi) || 1;
  let a = lo - span * 0.2;
  const b = hi + span * 0.2;
  if (lo >= 0 && a < 0) a = 0;
  const raw = (b - a) / 2;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const f of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20]) {
    const step = f * pow;
    const from = Math.floor(a / step) * step;
    if (from + 2 * step >= b) return [from, from + 2 * step];
  }
  return [a, b];
}

/** Where every value sits, in percent of the plot from the top – and the zero line, where bars and fills start */
type Geo = { ys: (number | null)[][]; zero: number };

/**
 * Eases from the geometry that was on screen to the new one whenever the data changes. The first view draws straight
 * away (the CSS draw-in does the entrance); reduced motion jumps.
 */
function useGlide(target: Geo, key: string, duration = 640): Geo {
  const shown = useRef<Geo | null>(null);
  const from = useRef<Geo | null>(null);
  const last = useRef<string | null>(null);
  const [state, setState] = useState<{ key: string; t: number }>({ key, t: 1 });
  if (last.current !== key) {
    from.current = last.current === null ? null : shown.current;
    last.current = key;
  }
  useEffect(() => {
    if (!from.current || reduced()) return setState({ key, t: 1 });
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setState({ key, t: easeOut(p) });
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  const t = state.key === key ? state.t : from.current ? 0 : 1;
  const prev = from.current;
  const geo: Geo =
    t >= 1 || !prev
      ? target
      : {
          zero: prev.zero + (target.zero - prev.zero) * t,
          ys: target.ys.map((row, k) =>
            row.map((to, i) => {
              if (to === null) return null;
              const old = prev.ys[k];
              // Different lengths: each point starts from the old point at the same place along the axis
              const j = old && old.length > 1 && row.length > 1 ? Math.round((i / (row.length - 1)) * (old.length - 1)) : 0;
              const a = old?.[j] ?? prev.zero;
              return a + (to - a) * t;
            }),
          ),
        };
  shown.current = geo;
  return geo;
}

export function TrendChart({
  labels = [],
  tooltipLabels,
  series = [],
  variant = "line",
  format = compact,
  axisFormat,
  height,
  axis,
  tooltip = true,
  zero = true,
  index,
  onIndexChange,
  defaultIndex,
  label = "Chart",
  emptyText = "No data yet",
  className,
}: TrendChartProps) {
  const uid = useId().replace(/:/g, "");
  const spark = variant === "sparkline";
  const bars = variant === "bar";
  const showY = axis === undefined ? !spark : axis === true;
  const showX = axis === undefined ? !spark : axis === true || axis === "x";
  // Without axes the chart is small – a tag beside the point instead of the popover
  const tagged = spark || (!showX && !showY);
  const count = labels.length;
  const fmt = (n: number) => safe(format, n);
  const axisFmt = (n: number) => safe(axisFormat ?? format, n);

  // One value per label – NaN, Infinity and values past the last label are left out
  const vals = useMemo(
    () => series.map((s) => Array.from({ length: count }, (_, i) => (finite(s.values?.[i]) ? (s.values[i] as number) : null))),
    [series, count],
  );
  const colors = useMemo(() => {
    let n = 0;
    return series.map((s) => s.color || (s.previous ? "var(--ui-trc-soft)" : PALETTE[n++ % PALETTE.length]));
  }, [series]);
  const all = vals.flat().filter(finite);
  const empty = all.length === 0 || (!spark && all.every((v) => v === 0));

  // The scale: from zero up to a round value. Only negatives hang down from zero; both signs get a scale mirrored
  // around zero, so the middle line is the zero line. A sparkline hugs its own range
  const top = Math.max(0, ...all);
  const low = Math.min(0, ...all);
  const both = top > 0 && low < 0 ? Math.max(niceMax(top), niceMax(-low)) : 0;
  const sLo = all.length ? Math.min(...all) : 0;
  const sHi = all.length ? Math.max(...all) : 1;
  // zero={false}: the axis zooms in around the values, so a small change in an average or a rate stays visible
  const zoom = !zero && !bars && !spark && all.length > 0 ? niceRange(sLo, sHi) : null;
  const max = zoom ? zoom[1] : both || (top > 0 || low === 0 ? niceMax(top) : 0);
  const min = zoom ? zoom[0] : both ? -both : low < 0 ? -niceMax(-low) : 0;
  const y = (v: number) =>
    spark ? (sHi === sLo ? 50 : 10 + ((sHi - v) / (sHi - sLo)) * 80) : ((max - v) / (max - min)) * 100;
  // Points sit on the edges for lines; bars sit in the middle of their slot
  const x = (i: number) => (bars ? ((i + 0.5) / Math.max(1, count)) * 100 : count > 1 ? (i / (count - 1)) * 100 : 50);

  const target: Geo = { ys: vals.map((vs) => vs.map((v) => (v === null ? null : y(v)))), zero: spark ? 100 : Math.min(100, Math.max(0, y(0))) };
  const key = JSON.stringify([variant, count, vals, max, min]);
  const geo = useGlide(target, key);

  // The highlighted point: controlled through `index`, otherwise hover, otherwise `defaultIndex`
  const clamp = (i: number | null | undefined) =>
    i == null || !finite(i) || count === 0 ? null : Math.min(count - 1, Math.max(0, Math.round(i)));
  const [hover, setHoverState] = useState<number | null>(null);
  const controlled = index !== undefined;
  const setHover = (i: number | null) => {
    if (!controlled) setHoverState(i);
    if (i !== (controlled ? clamp(index) : hover)) onIndexChange?.(i);
  };
  const active = empty ? null : controlled ? clamp(index) : (hover ?? clamp(defaultIndex));
  // The tooltip keeps its last content while it fades out
  const [shownIndex, setShownIndex] = useState(active ?? 0);
  if (active !== null && active !== shownIndex) setShownIndex(active);
  const cur = Math.min(shownIndex, Math.max(0, count - 1));

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - box.left) / (box.width || 1)));
    return clamp(bars ? Math.min(count - 1, Math.floor(ratio * count)) : ratio * (count - 1));
  };

  const onKey = (e: KeyboardEvent) => {
    if (count === 0 || empty) return;
    const from = active ?? (e.key === "ArrowLeft" ? count : -1);
    if (e.key === "ArrowRight") setHover(Math.min(count - 1, from + 1));
    else if (e.key === "ArrowLeft") setHover(Math.max(0, from - 1));
    else if (e.key === "Home") setHover(0);
    else if (e.key === "End") setHover(count - 1);
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  // Lines and fills from the gliding geometry – a gap where a value is missing
  const shapes = geo.ys.map((ys) => {
    const runs: [number, number][][] = [];
    ys.forEach((v, i) => {
      if (v === null) return;
      if (i === 0 || ys[i - 1] === null || !runs.length) runs.push([]);
      runs[runs.length - 1].push([x(i), v]);
    });
    const line = runs.map((r) => r.map(([px, py], j) => `${j ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join("")).join("");
    const area = runs
      .filter((r) => r.length > 1)
      .map((r) => `${r.map(([px, py], j) => `${j ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join("")}L${r[r.length - 1][0].toFixed(2)},${geo.zero.toFixed(2)}L${r[0][0].toFixed(2)},${geo.zero.toFixed(2)}Z`)
      .join("");
    // A point with no neighbour draws no line – it gets a dot
    const lone = runs.filter((r) => r.length === 1).map((r) => r[0]);
    return { line, area, lone };
  });

  // Bars: one group per label, a bar per series side by side
  const slot = 100 / Math.max(1, count);
  const group = slot * (count > 24 ? 0.72 : count > 12 ? 0.62 : 0.5);
  const each = group / Math.max(1, series.length);
  // A bar is never wider than 28px – one or two days don't turn into blocks; the group stays centered in its slot
  const barW = `min(${each}%, 28px)`;

  const rows = series
    .map((s, k) => ({ label: s.label, previous: !!s.previous, color: colors[k], key: k, value: vals[k][cur] ?? null }))
    .sort((a, b) => Number(a.previous) - Number(b.previous) || (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const lead = rows.find((r) => !r.previous && r.value !== null) ?? rows.find((r) => r.value !== null);
  const flip = x(cur) > 50;

  // The tooltip stays inside the chart: it slides back in when its side has too little room
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [nudge, setNudge] = useState(0);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const plot = plotRef.current;
    const tip = tipRef.current;
    if (!root || !plot || !tip) return;
    const edge = root.getBoundingClientRect();
    const box = plot.getBoundingClientRect();
    const w = tip.offsetWidth;
    const anchor = box.left + (x(cur) / 100) * box.width;
    const gap = tagged ? 8 : 14;
    const left = flip ? anchor - gap - w : anchor + gap;
    const lo = edge.left + (tagged ? 0 : 4);
    const hi = edge.right - (tagged ? 0 : 4) - w;
    const next = Math.round(left < lo ? lo - left : left > hi ? Math.max(lo, hi) - left : 0);
    if (next !== nudge) setNudge(next);
  });

  const axisPoints = [0, Math.round(count / 2 - 0.5), count - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
  const head = (tooltipLabels ?? labels)[cur] ?? labels[cur] ?? "";
  const open = active !== null || undefined;

  return (
    <>
      <style href="ui-trend-chart-clean" precedence="default">
        {css}
      </style>
      <div
        className={["ui-trc", className].filter(Boolean).join(" ")}
        data-variant={variant}
        data-axis={showY ? "both" : showX ? "x" : undefined}
        style={height ? { ["--ui-trc-h" as string]: `${Math.max(16, height)}px` } : undefined}
        ref={rootRef}
      >
        {showY && (
          <div className="ui-trc__yaxis" aria-hidden="true">
            {!empty && (
              <>
                <span>{axisFmt(max)}</span>
                <span>{axisFmt((max + min) / 2)}</span>
                <span>{axisFmt(min)}</span>
              </>
            )}
          </div>
        )}

        <div
          className="ui-trc__plot"
          tabIndex={empty ? undefined : 0}
          role="group"
          aria-label={empty ? `${label} – ${emptyText}` : `${label} – use the arrow keys to read the values`}
          data-empty={empty || undefined}
          ref={plotRef}
          onPointerMove={(e) => setHover(indexAt(e))}
          onPointerDown={(e) => setHover(indexAt(e))}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          {/* Grid lines belong to the axis; without one only the zero line stays, where values cross it */}
          {!spark && (showX || showY) && (
            <>
              <span className="ui-trc__grid" style={{ top: "0%" }} />
              <span className="ui-trc__grid" style={{ top: "50%" }} />
              <span className="ui-trc__grid" style={{ top: "100%" }} />
            </>
          )}
          {!spark && min < 0 && max > 0 && <span className="ui-trc__grid" data-zero="" style={{ top: `${geo.zero}%` }} />}

          {empty && <p className="ui-trc__empty" title={emptyText}>{emptyText}</p>}

          {bars ? (
            <div className="ui-trc__bars" aria-hidden="true">
              {geo.ys.map((ys, k) =>
                ys.map((v, i) =>
                  v === null ? null : (
                    <span
                      key={`${k}-${i}`}
                      className="ui-trc__bar"
                      data-previous={series[k].previous || undefined}
                      data-neg={v > geo.zero || undefined}
                      data-dim={(active !== null && active !== i) || undefined}
                      style={{
                        left: `calc(${(i + 0.5) * slot}% + ${k - series.length / 2} * ${barW} + 1px)`,
                        width: `calc(${barW} - 2px)`,
                        top: `${Math.min(v, geo.zero)}%`,
                        height: `${Math.abs(geo.zero - v)}%`,
                        background: colors[k],
                        animationDelay: `${Math.min(i, 30) * 18}ms`,
                      }}
                    />
                  ),
                ),
              )}
            </div>
          ) : (
            <svg className="ui-trc__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {(variant === "area" || spark) && (
                <defs>
                  {series.map((_, k) => (
                    <linearGradient key={k} id={`${uid}-f${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={colors[k]} stopOpacity={spark ? 0.16 : 0.2} />
                      <stop offset="1" stopColor={colors[k]} stopOpacity="0" />
                    </linearGradient>
                  ))}
                </defs>
              )}
              {(variant === "area" || spark) &&
                series.map((s, k) => (s.previous ? null : <path key={`a${k}`} className="ui-trc__fill" d={shapes[k].area} fill={`url(#${uid}-f${k})`} />))}
              {series.map((s, k) => (
                <path
                  key={k}
                  className="ui-trc__line"
                  data-previous={s.previous || undefined}
                  d={shapes[k].line}
                  stroke={colors[k]}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}

          {!bars &&
            shapes.flatMap((s, k) =>
              s.lone.map(([px, py]) => (
                <span key={`p${k}-${px}`} className="ui-trc__point" style={{ left: `${px}%`, top: `${py}%`, background: colors[k] }} aria-hidden="true" />
              )),
            )}

          {/* Hover marker: a hairline guide and one dot per line – bars fade the other days instead */}
          {!bars && (
            <div className="ui-trc__marker" data-open={open} aria-hidden="true">
              {!spark && <span className="ui-trc__guide" style={{ left: `${x(cur)}%` }} />}
              {series.map((s, k) =>
                geo.ys[k][cur] == null ? null : (
                  <span
                    key={k}
                    className="ui-trc__dot"
                    data-previous={s.previous || undefined}
                    style={{ left: `${x(cur)}%`, top: `${geo.ys[k][cur]}%`, background: colors[k] }}
                  />
                ),
              )}
            </div>
          )}

          {!tooltip ? null : tagged ? (
            // A sparkline (or any chart without axes) is too small for a popover – a dark tag beside the point carries the value
            <div
              className="ui-trc__tag"
              data-open={open}
              data-side={flip ? "left" : "right"}
              ref={tipRef}
              style={{ left: `${x(cur)}%`, top: `${lead && geo.ys[lead.key][cur] != null ? geo.ys[lead.key][cur] : 50}%`, ["--ui-trc-nudge" as string]: `${nudge}px` }}
              role="status"
              aria-live="polite"
            >
              {lead && lead.value !== null && <b>{fmt(lead.value)}</b>}
              <span dir="auto">{head}</span>
            </div>
          ) : (
            <div
              className="ui-trc__tooltip"
              data-open={open}
              data-side={flip ? "left" : "right"}
              ref={tipRef}
              style={{ left: `${x(cur)}%`, ["--ui-trc-nudge" as string]: `${nudge}px` }}
              role="status"
              aria-live="polite"
            >
              <p className="ui-trc__date" dir="auto">{head}</p>
              <ul>
                {rows.map((r) => (
                  <li key={r.key}>
                    <span className="ui-trc__swatch" data-previous={r.previous || undefined} style={{ ["--ui-trc-c" as string]: r.color }} />
                    <span className="ui-trc__label" dir="auto">{r.label}</span>
                    <span className="ui-trc__num">{r.value === null ? "—" : fmt(r.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showX && (
          <div className="ui-trc__xaxis" aria-hidden="true">
            {axisPoints.map((i) => (
              <span key={i} style={{ left: `${x(i)}%` }} data-edge={!bars && count > 1 ? (i === 0 ? "start" : i === count - 1 ? "end" : undefined) : undefined} data-mid={(i !== 0 && i !== count - 1) || undefined}>
                {labels[i]}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const css = /* css */ `
/* Colors and motion as variables – override them on .ui-trc */
.ui-trc {
  --ui-trc-h: 152px;
  --ui-trc-card: var(--aui-surface, #ffffff);
  --ui-trc-pop: var(--aui-overlay, #ffffff);
  --ui-trc-ink: var(--aui-ink, rgba(0, 0, 0, 0.88));
  --ui-trc-strong: var(--aui-ink, #000000);
  --ui-trc-text: var(--aui-muted, rgba(0, 0, 0, 0.61));
  --ui-trc-muted: var(--aui-muted, rgba(0, 0, 0, 0.45));
  --ui-trc-line: var(--aui-border, rgba(0, 0, 0, 0.06));
  --ui-trc-grid: rgba(0, 0, 0, 0.06);
  --ui-trc-zero: rgba(0, 0, 0, 0.16);
  --ui-trc-guide: rgba(0, 0, 0, 0.12);
  --ui-trc-soft: rgba(0, 0, 0, 0.3);
  --ui-trc-chip: rgba(0, 0, 0, 0.88);
  --ui-trc-chip-ink: #fcfcfc;
  --ui-trc-focus: var(--aui-focus, rgba(0, 96, 226, 0.7));
  --ui-trc-shadow-pop: var(--aui-shadow-popover, 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 12px 28px -10px rgba(0, 0, 0, 0.16), 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  --ui-trc-ease: var(--aui-ease, cubic-bezier(0.22, 1, 0.36, 1));
  box-sizing: border-box;
  container-type: inline-size;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: var(--ui-trc-h);
  width: 100%;
  min-width: 0;
  font-family: var(--aui-font, "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  color: var(--ui-trc-ink);
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}
.ui-trc *, .ui-trc *::before, .ui-trc *::after { box-sizing: border-box; }
.ui-trc[data-variant="sparkline"] { --ui-trc-h: 40px; }

/* With axes: value labels on the left, plot on the right, dates below */
.ui-trc[data-axis] {
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: var(--ui-trc-h) 16px;
  column-gap: 10px;
  row-gap: 8px;
}
/* Only the dates: the plot takes the full width */
.ui-trc[data-axis="x"] { grid-template-columns: minmax(0, 1fr); }
.ui-trc[data-axis="x"] .ui-trc__xaxis { grid-column: 1; }
.ui-trc__yaxis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  margin: -8px 0;
  font-size: 11px;
  line-height: 16px;
  text-align: right;
  color: var(--ui-trc-muted);
}
.ui-trc__yaxis span { white-space: nowrap; }

.ui-trc__plot {
  position: relative;
  min-width: 0;
  touch-action: pan-y;
  border-radius: 4px;
  outline: none;
  cursor: crosshair;
}
.ui-trc__plot:focus-visible {
  outline: 2px solid var(--ui-trc-focus);
  outline-offset: 2px;
}
.ui-trc__grid {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 0.5px solid var(--ui-trc-grid);
}
.ui-trc__grid[data-zero] { border-top-color: var(--ui-trc-zero); }

/* Lines and fills: thin, angular, drawn in from the left on first view */
.ui-trc__lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  animation: ui-trc-draw 1100ms var(--ui-trc-ease) both;
}
.ui-trc__line {
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ui-trc__line[data-previous] { stroke-width: 1.25; stroke-dasharray: 3 3; }
.ui-trc__fill { stroke: none; }

/* Bars: rounded at the free end, grow out of the zero line; on hover the other days fade */
.ui-trc__bars { position: absolute; inset: 0; }
.ui-trc__bar {
  position: absolute;
  min-height: 1px;
  border-radius: 3px 3px 1px 1px;
  transform-origin: bottom;
  animation: ui-trc-grow 700ms var(--ui-trc-ease) both;
  transition: opacity 160ms ease;
}
.ui-trc__bar[data-neg] { border-radius: 1px 1px 3px 3px; transform-origin: top; }
.ui-trc__bar[data-previous] { opacity: 0.32; }
.ui-trc__bar[data-dim] { opacity: 0.38; }
.ui-trc__bar[data-previous][data-dim] { opacity: 0.14; }

/* Hover marker: a hairline guide and one dot per line – short, crisp moves between points */
.ui-trc__marker {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms ease;
}
.ui-trc__marker[data-open] { opacity: 1; }
.ui-trc__guide,
.ui-trc__dot {
  position: absolute;
  transition: left 90ms ease-out, top 90ms ease-out;
}
.ui-trc__guide {
  top: -4px;
  bottom: 0;
  width: 0;
  border-left: 1px solid var(--ui-trc-guide);
  margin-left: -0.5px;
}
.ui-trc__dot {
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--ui-trc-card);
}
.ui-trc__dot[data-previous] { width: 6px; height: 6px; margin: -3px 0 0 -3px; }
.ui-trc[data-variant="sparkline"] .ui-trc__dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; box-shadow: 0 0 0 1.5px var(--ui-trc-card); }

/* A point without neighbours draws no line – it gets a dot */
.ui-trc__point {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--ui-trc-card);
  pointer-events: none;
  animation: ui-trc-pop 400ms var(--ui-trc-ease) both;
}

/* Nothing to draw: the grid stays, a quiet line sits on the middle one */
.ui-trc__plot[data-empty] { cursor: default; }
.ui-trc__plot[data-empty] > :not(.ui-trc__grid, .ui-trc__empty) { display: none; }
.ui-trc__empty {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: 100%;
  margin: 0;
  padding: 0 10px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: var(--ui-trc-card);
  transform: translate(-50%, -50%);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  color: var(--ui-trc-muted);
}

/* Tooltip: a small white popover beside the guide, flips to the left on the right half */
.ui-trc__tooltip {
  position: absolute;
  /* Its own width, not what's left right of the point – the nudge keeps it inside */
  width: max-content;
  top: -8px;
  z-index: 2;
  min-width: 152px;
  max-width: min(340px, calc(100cqw - 8px));
  padding: 6px 10px 8px;
  border-radius: var(--aui-radius-lg, 10px);
  background: var(--ui-trc-pop);
  box-shadow: var(--ui-trc-shadow-pop);
  pointer-events: none;
  opacity: 0;
  transform: translateX(calc(var(--ui-trc-shift) + var(--ui-trc-nudge, 0px))) scale(0.98);
  transition:
    left 90ms ease-out,
    opacity 140ms ease,
    transform 180ms var(--ui-trc-ease);
}
.ui-trc__tooltip[data-side="right"] { --ui-trc-shift: 14px; transform-origin: left top; }
.ui-trc__tooltip[data-side="left"] { --ui-trc-shift: calc(-100% - 14px); transform-origin: right top; }
.ui-trc__tooltip[data-open] {
  opacity: 1;
  transform: translateX(calc(var(--ui-trc-shift) + var(--ui-trc-nudge, 0px)));
}
.ui-trc__date {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--ui-trc-strong);
}
.ui-trc__tooltip ul {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 4px 0 0;
  padding: 4px 0 0;
  border-top: 0.5px solid var(--ui-trc-line);
  list-style: none;
}
.ui-trc__tooltip li {
  /* Swatch, name, value – the name takes what's left and wraps, the value never shrinks */
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--ui-trc-text);
}
.ui-trc__swatch {
  flex: none;
  margin-top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--ui-trc-c);
}
.ui-trc__swatch[data-previous] {
  height: 0;
  border-radius: 0;
  background: none;
  border-top: 1.5px dashed var(--ui-trc-c);
}
.ui-trc__label {
  /* Long names wrap to a second line, then end in an ellipsis – the value keeps its room */
  min-width: min(64px, 30%);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: break-word;
}
.ui-trc__num {
  flex: none;
  padding-left: 16px;
  color: var(--ui-trc-ink);
}

/* Sparkline tag: a dark chip beside the point, flips to the left on the right half */
.ui-trc__tag {
  position: absolute;
  /* Its own width, not what's left right of the point – the nudge keeps it inside */
  width: max-content;
  z-index: 2;
  display: flex;
  align-items: baseline;
  gap: 6px;
  max-width: calc(100cqw);
  padding: 2px 7px;
  border-radius: var(--aui-radius-sm, 5px);
  background: var(--ui-trc-chip);
  color: var(--ui-trc-chip-ink);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translate(calc(var(--ui-trc-shift) + var(--ui-trc-nudge, 0px)), -50%) scale(0.96);
  transition:
    left 90ms ease-out,
    top 90ms ease-out,
    opacity 140ms ease,
    transform 180ms var(--ui-trc-ease);
}
.ui-trc__tag[data-side="right"] { --ui-trc-shift: 8px; transform-origin: left center; }
.ui-trc__tag[data-side="left"] { --ui-trc-shift: calc(-100% - 8px); transform-origin: right center; }
.ui-trc__tag[data-open] { opacity: 1; transform: translate(calc(var(--ui-trc-shift) + var(--ui-trc-nudge, 0px)), -50%); }
.ui-trc__tag b { font-weight: 500; }
.ui-trc__tag span { min-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: 0.66; }

.ui-trc__xaxis {
  position: relative;
  grid-column: 2;
  min-width: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--ui-trc-muted);
}
.ui-trc__xaxis span {
  position: absolute;
  top: 0;
  max-width: 34%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-50%);
}
.ui-trc__xaxis span[data-edge="start"] { transform: none; }
.ui-trc__xaxis span[data-edge="end"] { transform: translateX(-100%); }

@keyframes ui-trc-draw {
  from { clip-path: inset(-10% 100% -10% 0); }
  to { clip-path: inset(-10% -2% -10% 0); }
}
@keyframes ui-trc-grow {
  from { transform: scaleY(0); }
}
@keyframes ui-trc-pop {
  from { opacity: 0; transform: scale(0.4); }
}

/* Narrow: a little less room between the axis and the plot */
@container (max-width: 320px) {
  .ui-trc[data-axis] { column-gap: 8px; }
  .ui-trc__xaxis span[data-mid] { display: none; }
  .ui-trc__xaxis span { max-width: 48%; }
  .ui-trc__tooltip { min-width: 136px; }
}
/* Too narrow for name and value side by side: the value moves under the name */
@container (max-width: 240px) {
  .ui-trc__tooltip li { grid-template-columns: auto minmax(0, 1fr); }
  .ui-trc__num { grid-column: 2; padding-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ui-trc__lines, .ui-trc__point, .ui-trc__bar { animation: none; }
  .ui-trc__marker, .ui-trc__guide, .ui-trc__dot, .ui-trc__tooltip, .ui-trc__tag, .ui-trc__bar { transition: none; }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-trc {
  --ui-trc-card: var(--aui-surface, #1c1c1e);
  --ui-trc-pop: var(--aui-overlay, #252527);
  --ui-trc-ink: var(--aui-ink, rgba(255, 255, 255, 0.9));
  --ui-trc-strong: var(--aui-ink, #ffffff);
  --ui-trc-text: var(--aui-muted, rgba(255, 255, 255, 0.62));
  --ui-trc-muted: var(--aui-muted, rgba(255, 255, 255, 0.46));
  --ui-trc-line: var(--aui-border, rgba(255, 255, 255, 0.08));
  --ui-trc-grid: rgba(255, 255, 255, 0.08);
  --ui-trc-zero: rgba(255, 255, 255, 0.2);
  --ui-trc-guide: rgba(255, 255, 255, 0.2);
  --ui-trc-soft: rgba(255, 255, 255, 0.36);
  --ui-trc-chip: rgba(255, 255, 255, 0.92);
  --ui-trc-chip-ink: #111111;
  --ui-trc-focus: var(--aui-focus, rgba(77, 141, 255, 0.8));
  --ui-trc-shadow-pop: var(--aui-shadow-popover, 0 0 0 0.5px rgba(255, 255, 255, 0.12), 0 12px 28px -10px rgba(0, 0, 0, 0.6));
}
`;
