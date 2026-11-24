// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

/*
 * Stat Card (clean style) – one number with its label, how it changed, and room for a chart. One self-contained file.
 *   · the change is a small tinted badge with an arrow – green when it went the right way, red when not;
 *     `lowerIsBetter` turns that around for latency, errors or cost
 *   · a number value rolls to its new value when it changes, and up from zero on first view
 *   · `chart` takes any node – a Trend Chart sparkline fits it exactly – below the number or beside it (`layout="inline"`)
 *   · `href` or `onClick` make the whole card a link or a button, while a chart inside it stays hoverable
 *   · `loading` keeps the card's size and shows quiet placeholders instead of numbers
 * The styles are injected below, so no extra files are needed.
 */

export type StatCardProps = {
  label: string;
  /** A number rolls when it changes and is shown through `format`; a string is shown as it is */
  value: number | string;
  /** Formats a number value, e.g. (n) => `$${(n / 1000).toFixed(1)}k` */
  format?: (n: number) => string;
  /** Change in percent against the period before, e.g. 12.4 or -3 */
  change?: number;
  /** Formats the change – "12.4%" by default; gets the absolute value, the arrow shows the direction */
  changeFormat?: (n: number) => string;
  /** Quiet text after the change, e.g. "vs last week" */
  changeLabel?: string;
  /** A rise is bad news – latency, errors, cost – so it shows red and a fall green */
  lowerIsBetter?: boolean;
  /** A 16px icon before the label */
  icon?: ReactNode;
  /** Any chart, e.g. <TrendChart variant="sparkline" … /> */
  chart?: ReactNode;
  /** The chart below the number (stacked) or to its right (inline) */
  layout?: "stacked" | "inline";
  /** The card's last row, e.g. "Updated 2 min ago" */
  footer?: ReactNode;
  /** Placeholders instead of the number, change and chart – the card keeps its size */
  loading?: boolean;
  /** Makes the whole card a link */
  href?: string;
  /** Makes the whole card a button */
  onClick?: () => void;
  /** Extra attributes for that link or button – e.g. role="tab", aria-selected and tabIndex when the cards pick what a chart shows */
  hitProps?: HTMLAttributes<HTMLElement>;
  /** A small control in the top right corner – a menu, a filter; it stays clickable on a link card */
  action?: ReactNode;
  /** One card of a set is picked: false fades this card's content, true or undefined shows it fully */
  selected?: boolean;
  className?: string;
  style?: CSSProperties;
};

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - (1 - t) ** 4;

/** 1284 → "1,284", 2.5e9 → "2.5B" – a readable default for a bare number */
const plain = (n: number) =>
  Math.abs(n) >= 1e6
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(n) < 10 ? 2 : 0 }).format(n);
/** 12.4%, 12,400%, and small changes keep their digits – 0.04% instead of a misleading 0% */
const percent = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: n >= 100 ? 0 : n < 1 ? 2 : 1 }).format(n)}%`;

/** A formatter that throws or returns nothing still gives readable text */
const safe = (format: (n: number) => string, n: number, fallback = plain) => {
  try {
    const s = format(n);
    return s == null || s === "" ? fallback(n) : String(s);
  } catch {
    return fallback(n);
  }
};

/** Rolls a number from where it was to where it is now – from zero on first view */
function useRoll(target: number | null, duration = 720) {
  const [shown, setShown] = useState<number | null>(() => (target === null || reduced() ? target : 0));
  const from = useRef(shown ?? 0);
  const now = useRef(shown);
  now.current = shown;
  useEffect(() => {
    if (target === null || reduced()) return setShown(target);
    from.current = now.current ?? 0;
    if (from.current === target) return;
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(from.current + (target - from.current) * easeOut(p));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

const Arrow = ({ up }: { up: boolean }) => (
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" style={up ? undefined : { transform: "scaleY(-1)" }}>
    <path d="M4 1.2 7.2 6.4H.8L4 1.2Z" fill="currentColor" />
  </svg>
);

export function StatCard({
  label,
  value,
  format = plain,
  change,
  changeFormat = percent,
  changeLabel,
  lowerIsBetter = false,
  icon,
  chart,
  layout = "stacked",
  footer,
  loading = false,
  href,
  onClick,
  hitProps,
  action,
  selected,
  className,
  style,
}: StatCardProps) {
  const num = finite(value) ? value : null;
  const rolled = useRoll(loading ? null : num);
  // A missing value – empty, NaN, Infinity – reads as a quiet dash, never as "NaN"
  const text = num !== null ? safe(format, rolled ?? num) : typeof value !== "string" || value === "" ? "—" : value;
  // The real value for screen readers, not a number on its way
  const spoken = num !== null ? safe(format, num) : text;

  const hasChange = finite(change);
  const trend = !hasChange ? null : change > 0 ? "up" : change < 0 ? "down" : "flat";
  const good = trend === "flat" || trend === null ? null : (trend === "up") !== lowerIsBetter;
  const changeText = hasChange ? safe(changeFormat, Math.abs(change), percent) : "";
  const spokenChange = !hasChange
    ? ""
    : trend === "flat"
      ? `unchanged ${changeLabel ?? ""}`
      : `${trend === "up" ? "up" : "down"} ${changeText} ${changeLabel ?? ""}`;

  const Hit = href ? "a" : onClick ? "button" : null;

  return (
    <>
      <style href="ui-stat-card-clean" precedence="default">
        {css}
      </style>
      <section
        className={["ui-statc", className].filter(Boolean).join(" ")}
        data-layout={layout}
        data-link={Hit ? "" : undefined}
        data-loading={loading || undefined}
        data-dim={selected === false || undefined}
        style={style}
        aria-busy={loading || undefined}
      >
        {Hit && (
          // The whole card is the target – it lies under the content, and a chart above it stays hoverable
          <Hit
            className="ui-statc__hit"
            {...hitProps}
            {...(href ? { href } : { type: "button" as const, onClick })}
            aria-label={`${label}: ${loading ? "loading" : `${spoken}${spokenChange ? `, ${spokenChange}` : ""}`}`}
          />
        )}
        <div className="ui-statc__body">
          <div className="ui-statc__text">
            {action && <div className="ui-statc__action">{action}</div>}
            <p className="ui-statc__label" title={label} dir="auto">
              {icon && (
                <span className="ui-statc__icon" aria-hidden="true">
                  {icon}
                </span>
              )}
              <span>{label}</span>
            </p>
            {loading ? (
              <>
                {/* Placeholders sit in the same lines as the real value and change – nothing moves when they arrive */}
                <p className="ui-statc__value">
                  <span className="ui-statc__skel ui-statc__skel--value" />
                </p>
                {(change !== undefined || changeLabel) && (
                  <p className="ui-statc__meta">
                    <span className="ui-statc__skel ui-statc__skel--change" />
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="ui-statc__value">
                  <span aria-hidden={num !== null || undefined}>{text}</span>
                  {num !== null && <span className="ui-statc__sr">{spoken}</span>}
                </p>
                {(hasChange || changeLabel) && (
                  <p className="ui-statc__meta">
                    {hasChange && (
                      <span className="ui-statc__change" data-good={good === null ? undefined : good ? "" : "no"}>
                        {trend !== "flat" && <Arrow up={trend === "up"} />}
                        <span aria-hidden="true">{changeText}</span>
                        <span className="ui-statc__sr">{spokenChange}</span>
                      </span>
                    )}
                    {changeLabel && (
                      <span className="ui-statc__vs" title={changeLabel} dir="auto" aria-hidden={hasChange || undefined}>
                        {changeLabel}
                      </span>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
          {(chart || loading) && <div className="ui-statc__chart">{loading ? <span className="ui-statc__skel ui-statc__skel--chart" /> : chart}</div>}
        </div>
        {footer && (
          <div className="ui-statc__footer" dir="auto">
            {footer}
          </div>
        )}
      </section>
    </>
  );
}

const css = /* css */ `
/* Colors and motion as variables – override them on .ui-statc */
.ui-statc {
  --ui-statc-card: var(--aui-surface, #ffffff);
  --ui-statc-ink: var(--aui-ink, rgba(0, 0, 0, 0.88));
  --ui-statc-strong: var(--aui-ink, #000000);
  --ui-statc-text: var(--aui-muted, rgba(0, 0, 0, 0.61));
  --ui-statc-muted: var(--aui-muted, rgba(0, 0, 0, 0.45));
  --ui-statc-line: var(--aui-border, rgba(0, 0, 0, 0.06));
  --ui-statc-skel: rgba(0, 0, 0, 0.05);
  --ui-statc-sheen: rgba(255, 255, 255, 0.7);
  --ui-statc-good: var(--aui-success, #1e8a4f);
  --ui-statc-good-bg: color-mix(in srgb, var(--aui-green, #5fc88a) 10%, transparent);
  --ui-statc-bad: var(--aui-danger, #c4320a);
  --ui-statc-bad-bg: color-mix(in srgb, var(--aui-red, #f04438) 10%, transparent);
  --ui-statc-flat-bg: rgba(0, 0, 0, 0.05);
  --ui-statc-focus: var(--aui-focus, rgba(0, 96, 226, 0.7));
  /* Strokes are shadows: a 0.5px hairline plus a soft lift */
  --ui-statc-shadow: var(--aui-shadow-card, 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 1px -1px rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  --ui-statc-shadow-hover: 0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.08), 0 4px 12px -4px rgba(0, 0, 0, 0.08);
  --ui-statc-ease: var(--aui-ease, cubic-bezier(0.22, 1, 0.36, 1));
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: var(--aui-radius-lg, 10px);
  background: var(--ui-statc-card);
  box-shadow: var(--ui-statc-shadow);
  font-family: var(--aui-font, "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  color: var(--ui-statc-ink);
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
  transition: box-shadow 160ms ease;
}
.ui-statc *, .ui-statc *::before, .ui-statc *::after { box-sizing: border-box; }

/* A link or button card: the target lies under the content; the ring goes around the whole card */
.ui-statc__hit {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: none;
  cursor: pointer;
  outline: none;
}
.ui-statc[data-link]:hover { box-shadow: var(--ui-statc-shadow-hover); }
.ui-statc:has(.ui-statc__hit:focus-visible) {
  outline: 2px solid var(--ui-statc-focus);
  outline-offset: 2px;
}
.ui-statc[data-link] .ui-statc__body,
.ui-statc[data-link] .ui-statc__footer { position: relative; z-index: 1; pointer-events: none; }
.ui-statc[data-link] .ui-statc__chart,
.ui-statc[data-link] .ui-statc__action { pointer-events: auto; }

/* One of a set is picked: the others fade, no ring */
.ui-statc__body > *, .ui-statc__footer { transition: opacity 260ms ease; }
.ui-statc[data-dim] .ui-statc__body > *, .ui-statc[data-dim] .ui-statc__footer { opacity: 0.45; }
.ui-statc[data-dim][data-link]:hover .ui-statc__body > *, .ui-statc[data-dim][data-link]:hover .ui-statc__footer { opacity: 0.75; }

.ui-statc__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 12px;
  padding: 14px 16px 16px;
}
.ui-statc[data-layout="inline"] .ui-statc__body {
  grid-template-columns: minmax(0, 1fr) minmax(0, 44%);
  column-gap: 16px;
  align-items: end;
}
.ui-statc__text { position: relative; min-width: 0; }
/* The corner control floats top right; the label leaves room for it */
.ui-statc__action { float: right; margin: -4px -6px 0 8px; }

.ui-statc__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ui-statc-text);
}
.ui-statc__label > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-statc__icon { display: inline-flex; flex: none; width: 16px; height: 16px; color: var(--ui-statc-muted); }
.ui-statc__icon svg { width: 16px; height: 16px; }

.ui-statc__value {
  margin: 2px 0 0;
  font-size: 24px;
  font-weight: 500;
  line-height: 32px;
  letter-spacing: -0.24px;
  color: var(--ui-statc-strong);
  overflow-wrap: anywhere;
}

.ui-statc__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-statc-muted);
}
/* The change: a small tinted badge – green when it went the right way, red when not, gray when flat */
.ui-statc__change {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--aui-radius-sm, 5px);
  background: var(--ui-statc-flat-bg);
  font-weight: 500;
  color: var(--ui-statc-text);
  white-space: nowrap;
}
.ui-statc__change[data-good=""] { background: var(--ui-statc-good-bg); color: var(--ui-statc-good); }
.ui-statc__change[data-good="no"] { background: var(--ui-statc-bad-bg); color: var(--ui-statc-bad); }
.ui-statc__change svg { width: 7px; height: 7px; }
.ui-statc__vs { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ui-statc__chart { min-width: 0; }

.ui-statc__footer {
  overflow-wrap: anywhere;
  margin-top: auto;
  padding: 10px 16px;
  border-top: 0.5px solid var(--ui-statc-line);
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-statc-muted);
}

/* Loading: placeholders at the size of what they stand for, a slow sheen running over them */
.ui-statc__skel {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 4px;
  background: var(--ui-statc-skel);
}
.ui-statc__skel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--ui-statc-sheen), transparent);
  transform: translateX(-100%);
  animation: ui-statc-sheen 1600ms ease-in-out infinite;
}
.ui-statc__skel--value,
.ui-statc__skel--change { display: inline-block; vertical-align: middle; }
.ui-statc__skel--value { width: 96px; height: 24px; }
.ui-statc__skel--change { width: 120px; height: 20px; }
/* The chart placeholder is a sparkline's height – set --ui-statc-skel-h for a taller chart */
.ui-statc__skel--chart { width: 100%; height: var(--ui-statc-skel-h, 40px); }

.ui-statc__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@keyframes ui-statc-sheen {
  to { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .ui-statc { transition: none; }
  .ui-statc__skel::after { animation: none; }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-statc {
  --ui-statc-card: var(--aui-surface, #1c1c1e);
  --ui-statc-ink: var(--aui-ink, rgba(255, 255, 255, 0.9));
  --ui-statc-strong: var(--aui-ink, #ffffff);
  --ui-statc-text: var(--aui-muted, rgba(255, 255, 255, 0.62));
  --ui-statc-muted: var(--aui-muted, rgba(255, 255, 255, 0.46));
  --ui-statc-line: var(--aui-border, rgba(255, 255, 255, 0.08));
  --ui-statc-skel: rgba(255, 255, 255, 0.06);
  --ui-statc-sheen: rgba(255, 255, 255, 0.06);
  --ui-statc-good: var(--aui-green, #5fc88a);
  --ui-statc-good-bg: color-mix(in srgb, var(--aui-green, #7dcf9f) 12%, transparent);
  --ui-statc-bad: var(--aui-danger, #ff8a7a);
  --ui-statc-bad-bg: color-mix(in srgb, var(--aui-red, #ff6b5f) 12%, transparent);
  --ui-statc-flat-bg: rgba(255, 255, 255, 0.07);
  --ui-statc-focus: var(--aui-focus, rgba(77, 141, 255, 0.8));
  --ui-statc-shadow: var(--aui-shadow-card, 0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.4));
  --ui-statc-shadow-hover: 0 0 0 0.5px rgba(255, 255, 255, 0.16), 0 4px 12px -4px rgba(0, 0, 0, 0.6);
}
`;
