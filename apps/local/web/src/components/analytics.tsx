// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * Analytics – a revenue dashboard, in a single file.
 * Four key figures with mini bars, revenue by channel next to a breakdown with sparklines,
 * then top products and two week-over-week charts filling the rest of the panel.
 * Sits in the affectUI App Shell; built from the library's Stat Card, Trend Chart and Button, icons from the Hugeicons free set.
 */

import { useState, type CSSProperties } from "react";
import {
  Analytics01Icon,
  Calendar03Icon,
  Download04Icon,
  Home01Icon,
  Invoice01Icon,
  Store01Icon,
  ShoppingBag01Icon,
  UserMultipleIcon,
  Wallet01Icon,
  RepeatIcon,
  Link01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { TrendChart, type TrendSeries } from "@/components/ui/trend-chart-clean";
import { AppShell, EmptyState, Icon, Loading, MenuButton, Skeleton, useToast, type AppShellProps, type ShellGroup, type ShellNavItem } from "@/components/app-shell";

/** Sample content – replace with your own data */
const nav: ShellNavItem[] = [
  { label: "Home", icon: Home01Icon },
  { label: "Revenue", icon: Analytics01Icon },
  { label: "Invoices", icon: Invoice01Icon, count: 12 },
  { label: "Payouts", icon: Wallet01Icon },
  { label: "Customers", icon: UserMultipleIcon },
];
const groups: ShellGroup[] = [
  {
    label: "Channels",
    items: [
      { label: "Online store", icon: Store01Icon },
      { label: "Marketplace", icon: ShoppingBag01Icon },
      { label: "Wholesale", icon: Wallet01Icon },
      { label: "Subscriptions", icon: RepeatIcon },
    ],
  },
];

const labels = ["Mar 3", "Mar 4", "Mar 5", "Mar 6", "Mar 7", "Mar 8", "Mar 9"];
const tooltipLabels = ["Mon, Mar 3", "Tue, Mar 4", "Wed, Mar 5", "Thu, Mar 6", "Fri, Mar 7", "Sat, Mar 8", "Sun, Mar 9"];
const series: TrendSeries[] = [
  { label: "Organic", color: "#4fb0fe", values: [4200, 4700, 3900, 4600, 5400, 5100, 5900] },
  { label: "Paid ads", color: "#ee3e9e", values: [3600, 3300, 4400, 4800, 4000, 4500, 4200] },
  { label: "Referral", color: "#a651f0", values: [1800, 2300, 2000, 1500, 2400, 2200, 2700] },
  { label: "Email", color: "#13b3a0", values: [1200, 1100, 1700, 2100, 1600, 1300, 1500] },
];
// Millions as M, thousands as k; small values keep a decimal, so a tiny axis doesn't read $0 · $1 · $1
const money = (n: number) =>
  !Number.isFinite(n)
    ? "$0"
    : n >= 1e6
      ? `$${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`
      : n >= 1000
        ? `$${+(n / 1000).toFixed(1)}k`
        : `$${+n.toFixed(n < 10 ? 1 : 0)}`;

/** This week against last week – for the two small charts */
const compare = (a: number[], b: number[]): TrendSeries[] => [
  { label: "This week", color: "#4fb0fe", values: a },
  { label: "Last week", color: "#a6d7fe", values: b },
];
const sessions = compare([1820, 2140, 1960, 2480, 2710, 2390, 2950], [1650, 1720, 1880, 1790, 2010, 1940, 2100]);
const orderValue = compare([118, 124, 121, 132, 129, 137, 141], [112, 115, 119, 117, 121, 120, 124]);

export type AnalyticsStat = {
  label: string;
  value: string;
  delta: string;
  bars: number[];
  /** Which way is good news – a falling refund rate is; colors the delta green or red */
  good?: "up" | "down";
};
export type AnalyticsLine = { label: string; value: string; spark: number[]; tone?: "up" | "down" | "flat" };
export type AnalyticsProduct = { label: string; value: string; share: number };

const stats: AnalyticsStat[] = [
  { label: "Gross revenue", value: "$96,412", delta: "+12.5%", bars: [5, 7, 6, 8, 7, 9, 10] },
  { label: "Active customers", value: "2,847", delta: "+8.2%", bars: [6, 6, 7, 7, 8, 8, 9] },
  { label: "Conversion", value: "3.24%", delta: "+0.4%", bars: [7, 5, 6, 8, 6, 7, 8] },
  { label: "Refund rate", value: "1.8%", delta: "-0.3%", good: "down", bars: [9, 8, 8, 6, 7, 5, 4] },
];

const breakdown: AnalyticsLine[] = [
  { label: "Gross sales", value: "$104,210", spark: [3, 5, 4, 6, 5, 7, 8] },
  { label: "Discounts", value: "−$4,180", spark: [4, 3, 5, 4, 3, 4, 3], tone: "down" },
  { label: "Refunds", value: "−$1,734", spark: [5, 4, 4, 3, 3, 2, 2], tone: "down" },
  { label: "Shipping", value: "$2,940", spark: [2, 3, 3, 4, 3, 4, 5] },
  { label: "Taxes", value: "$8,316", spark: [4, 4, 4, 4, 4, 4, 4], tone: "flat" },
  { label: "Net revenue", value: "$96,412", spark: [3, 4, 4, 5, 6, 6, 8] },
];

const products: AnalyticsProduct[] = [
  { label: "Annual plan", value: "$38,400", share: 100 },
  { label: "Team seats", value: "$24,150", share: 63 },
  { label: "Monthly plan", value: "$18,920", share: 49 },
  { label: "Add-ons", value: "$9,640", share: 25 },
];

/** Key figures for the period: money and counts grow with it, rates stay rates */
function statValue(label: string, f: number) {
  if (label === "Gross revenue") return usd(96412 * f);
  if (label === "Active customers") return Math.round(2847 * Math.sqrt(f)).toLocaleString("en-US");
  if (label === "Conversion") return `${(3.24 + (f - 1) * 0.012).toFixed(2)}%`;
  if (label === "Refund rate") return `${(1.8 + (f - 1) * 0.008).toFixed(1)}%`;
  return "";
}


/** Small trend line for the breakdown list – values are spread over its height; one value is a flat line */
function Spark({ values: raw, tone = "up" }: { values: number[]; tone?: "up" | "down" | "flat" }) {
  const values = raw.filter(Number.isFinite);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts =
    values.length < 2
      ? values.length ? "0,7 40,7" : ""
      : values.map((v, i) => `${(i / (values.length - 1)) * 40},${tone === "flat" ? 7 : 13 - ((v - min) / (max - min || 1)) * 12}`).join(" ");
  return (
    <svg className="ui-as-rev__spark" data-tone={tone} viewBox="0 0 40 14" aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}

type Period = "7d" | "30d" | "90d";
const periods: { value: Period; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];
/** Axis labels and how much bigger the totals are for each period – sample data */
const span: Record<Period, { labels: string[]; factor: number }> = {
  "7d": { labels, factor: 1 },
  "30d": { labels: ["Feb 9", "Feb 14", "Feb 19", "Feb 24", "Mar 1", "Mar 5", "Mar 9"], factor: 4.3 },
  "90d": { labels: ["Dec 10", "Dec 25", "Jan 9", "Jan 24", "Feb 8", "Feb 23", "Mar 9"], factor: 12.9 },
};
/** Scales a series to the period, with a little wobble so longer periods don't look like copies */
const scaleSeries = (list: TrendSeries[], period: Period): TrendSeries[] =>
  list.map((s, k) => ({
    ...s,
    values: s.values.map((v, i) => (v === null ? null : Math.round(v * span[period].factor * (period === "7d" ? 1 : 1 + 0.09 * Math.sin(i * 1.7 + k))))),
  }));
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export type AnalyticsScreenProps = Pick<AppShellProps, "onNavigate" | "workspace" | "user" | "className"> & {
  /** Key figures on top */
  stats?: AnalyticsStat[];
  /** Lines of the revenue breakdown */
  breakdown?: AnalyticsLine[];
  /** Top products, share in % of the best one */
  products?: AnalyticsProduct[];
  /** Lines of the revenue chart, one value per day */
  channels?: TrendSeries[];
  /** While your data loads: the key figures, charts, breakdown and top products show gray placeholders in the shape of the real ones, in the same cards */
  loading?: boolean;
  /** No data yet: the header stays, the key figures and charts give way to one empty state with a Connect store button */
  empty?: boolean;
  /** Called by the empty state's Connect store button */
  onConnect?: () => void;
};

/** A gray bar centered in the text line it stands in for – the line keeps its height */
const SkelLine = ({ width, height = 10 }: { width: number | string; height?: number }) => (
  <span className="ui-as-rev__skel-line">
    <Skeleton width={width} height={height} />
  </span>
);
/** Widths for the loading state – fixed, so it renders the same every time */
const skelStats = [104, 72, 80, 88];
const skelLines = [88, 72, 64, 76, 56, 92];

const thousands = (n: number) => (Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

/**
 * A chart card: the library's Stat Card with a Trend Chart in it – title, figure, the change against the period
 * before (in the figure's own unit) and the lines. While loading the same card shows its placeholders, at the same size.
 */
function ChartCard({
  title,
  value = 0,
  delta,
  format,
  labels: axisLabels = [],
  tooltipLabels: tips,
  series: lines = [],
  footer,
  tall,
  loading,
}: {
  title: string;
  value?: number;
  delta?: number;
  format?: (n: number) => string;
  labels?: string[];
  tooltipLabels?: string[];
  series?: TrendSeries[];
  footer?: string;
  tall?: boolean;
  loading?: boolean;
}) {
  return (
    <StatCard
      className={["ui-as-rev__chart", tall && "ui-as-rev__chart--tall"].filter(Boolean).join(" ")}
      label={title}
      value={value}
      format={format}
      // While loading, a change of 0 keeps the change line's placeholder, so the card has its loaded height
      change={loading ? 0 : delta === undefined || !Number.isFinite(delta) ? undefined : delta}
      changeFormat={format}
      footer={footer ?? (loading ? <SkelLine width={96} height={8} /> : undefined)}
      loading={loading}
      chart={loading ? <span /> : <TrendChart variant="line" label={title} labels={axisLabels} tooltipLabels={tips} series={lines} format={format} />}
    />
  );
}

export function AnalyticsScreen({ stats: statList = stats, breakdown: lines = breakdown, products: productList = products, channels = series, loading, empty: emptyProp, onConnect, ...props }: AnalyticsScreenProps) {
  // Loading wins over empty
  const empty = !!emptyProp && !loading;
  const [period, setPeriod] = useState<Period>("7d");
  const [toast, showToast] = useToast();
  const f = span[period].factor;
  const axis = span[period].labels;
  const tips = period === "7d" ? tooltipLabels : axis;
  // The sample data grows with the period; data passed in is shown as given
  const sampleChannels = channels === series;
  const channelSeries = sampleChannels ? scaleSeries(channels, period) : channels;
  const channelTotal = channelSeries.reduce((n, s) => n + s.values.reduce<number>((m, v) => m + (typeof v === "number" && Number.isFinite(v) ? v : 0), 0), 0);
  const k = (n: number) => usd(n * f);
  const share = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

  return (
    <AppShell active="Revenue" nav={nav} groups={groups} {...props}>
      <style href="ui-screen-analytics" precedence="default">
        {css}
      </style>
      <div className="ui-as-rev">
        <header className="ui-as-rev__head">
          {/* A quiet path like the other screens: section, then the page */}
          <h1 className="ui-as-rev__path">
            <span>Analytics</span>
            <i>/</i>
            <b>Revenue</b>
          </h1>
          <div className="ui-as-rev__actions">
            <MenuButton value={period} options={periods} onChange={setPeriod} icon={Calendar03Icon} className="ui-as-rev__period" />
            <Button variant="secondary" size="sm" icon={<Icon icon={Download04Icon} size={14} />} onClick={() => showToast("Export started")}>
              Export
            </Button>
            <Button size="sm" onClick={() => showToast("Saved to Reports")}>
              Save as report
            </Button>
          </div>
        </header>

        <div className="ui-as-rev__content" key={period}>
          {loading && (
            <div className="ui-as-rev__stats">
              {skelStats.map((_, i) => (
                <StatCard key={i} className="ui-as-rev__stat" layout="inline" label={statList[i]?.label ?? stats[i].label} value="" change={0} loading chart={<span />} />
              ))}
            </div>
          )}
          {empty && (
            <EmptyState
              icon={Analytics01Icon}
              title="No revenue yet"
              text="Key figures, channels and top products show up here once your first orders come in."
              action={
                <Button variant="secondary" size="sm" icon={<Icon icon={Link01Icon} size={15} />} onClick={() => (onConnect ? onConnect() : showToast("Store connected"))}>
                  Connect store
                </Button>
              }
            />
          )}
          {!loading && !empty && statList.length > 0 && (
            <div className="ui-as-rev__stats">
              {statList.map((s, i) => {
                const delta = parseFloat((s.delta ?? "").replace(/[−–]/g, "-").replace(/[^\d.-]/g, ""));
                return (
                  <StatCard
                    key={s.label}
                    className="ui-as-rev__stat ui-as-rise"
                    style={{ "--i": i } as CSSProperties}
                    layout="inline"
                    label={s.label}
                    value={(statList === stats && statValue(s.label, f)) || s.value}
                    change={s.delta ? delta : undefined}
                    lowerIsBetter={s.good === "down"}
                    chart={
                      // The mini bars: a Trend Chart without axes or tooltip, quiet gray
                      <TrendChart
                        variant="bar"
                        axis={false}
                        tooltip={false}
                        height={22}
                        label={`${s.label} by day`}
                        labels={s.bars.map((_, j) => labels[j] ?? `${j + 1}`)}
                        series={[{ label: s.label, values: s.bars, color: "var(--faint)" }]}
                      />
                    }
                  />
                );
              })}
            </div>
          )}

          {!empty && (
          <>
          <div className="ui-as-rev__row ui-as-rev__row--main">
            {loading ? (
              <>
                <ChartCard tall loading title="Revenue by channel" />
                <div className="ui-as-rev__card ui-as-rev__breakdown">
                  <span className="ui-as-rev__cap">Revenue breakdown</span>
                  <Loading label="Loading revenue breakdown">
                    <ul>
                      {skelLines.map((w, i) => (
                        <li key={i} data-skel="">
                          <Skeleton width={w} height={10} />
                          <Skeleton width={[64, 52, 52, 48, 48, 64][i]} height={10} />
                          <Skeleton width={40} height={14} radius={4} />
                        </li>
                      ))}
                    </ul>
                  </Loading>
                </div>
              </>
            ) : (
            <>
            <ChartCard
              tall
              title="Revenue by channel"
              value={sampleChannels ? 96400 * f : channelTotal}
              delta={sampleChannels ? Math.round(7900 * f) : undefined}
              format={money}
              labels={axis}
              tooltipLabels={tips}
              series={channelSeries}
              footer={channelSeries.length ? `Top ${channelSeries.length} ${channelSeries.length === 1 ? "channel" : "channels"}` : undefined}
            />
            <div className="ui-as-rev__card ui-as-rev__breakdown">
              <span className="ui-as-rev__cap">Revenue breakdown</span>
              {lines.length === 0 && <EmptyState bare icon={Invoice01Icon} title="No revenue in this period" text="Sales, discounts and refunds add up here." />}
              <ul>
                {lines.map((r) => (
                  <li key={r.label}>
                    <span title={r.label}>{r.label}</span>
                    <b>{lines === breakdown ? (r.value.startsWith("−") ? "−" : "") + k(+r.value.replace(/[^\d]/g, "")) : r.value}</b>
                    <Spark values={r.spark} tone={r.tone} />
                  </li>
                ))}
              </ul>
            </div>
            </>
            )}
          </div>

          <div className="ui-as-rev__row ui-as-rev__row--3">
            {loading ? (
              <>
                <div className="ui-as-rev__card ui-as-rev__products">
                  <span className="ui-as-rev__cap">Top products</span>
                  <Loading label="Loading top products" className="ui-as-rev__products">
                    {[100, 72, 54, 36].map((share, i) => (
                      <div key={i} className="ui-as-rev__product" data-skel="">
                        <span>
                          <SkelLine width={[92, 76, 100, 60][i]} />
                          <SkelLine width={56} />
                        </span>
                        <Skeleton width={`${share}%`} height={6} radius={3} />
                      </div>
                    ))}
                  </Loading>
                </div>
                <ChartCard loading title="Sessions over time" footer={period === "7d" ? "This week vs. last week" : "This period vs. the one before"} />
                <ChartCard loading title="Average order value" footer={period === "7d" ? "This week vs. last week" : "This period vs. the one before"} />
              </>
            ) : (
            <>
            <div className="ui-as-rev__card ui-as-rev__products">
              <span className="ui-as-rev__cap">Top products</span>
              {productList.length === 0 && <EmptyState bare icon={ShoppingBag01Icon} title="No sales in this period" text="Your best-selling products show up here." />}
              {productList.map((p) => (
                <div key={p.label} className="ui-as-rev__product">
                  <span>
                    <span className="ui-as-rev__product-name" title={p.label}>
                      {p.label}
                    </span>
                    <b>{productList === products ? k(+p.value.replace(/[^\d]/g, "")) : p.value}</b>
                  </span>
                  <i style={{ width: `${share(p.share)}%` }} />
                </div>
              ))}
            </div>
            <ChartCard
              title="Sessions over time"
              value={16400 * f}
              delta={Math.round(2340 * f)}
              format={thousands}
              labels={axis}
              tooltipLabels={tips}
              series={scaleSeries(sessions, period)}
              footer={period === "7d" ? "This week vs. last week" : "This period vs. the one before"}
            />
            <ChartCard
              title="Average order value"
              value={141}
              delta={17}
              format={(n) => `$${Math.round(n)}`}
              labels={axis}
              tooltipLabels={tips}
              series={orderValue}
              footer={period === "7d" ? "This week vs. last week" : "This period vs. the one before"}
            />
            </>
            )}
          </div>
          </>
          )}
        </div>
      </div>
      {toast}
    </AppShell>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
/* Revenue dashboard: a header, then rows of white cards on the panel */
.ui-as-rev { display: flex; flex-direction: column; min-height: 100%; }
/* The bar stays on top while the page scrolls under it */
.ui-as-rev__head { position: sticky; top: 0; z-index: 6; display: flex; flex: none; align-items: center; justify-content: space-between; gap: 12px; height: var(--as-head-h, 48px); padding: 0 12px 0 20px; background: var(--panel); }
.ui-as-rev__path { display: flex; align-items: center; gap: 8px; min-width: 0; margin: 0; font-size: 13px; font-weight: 400; color: var(--muted); white-space: nowrap; }
.ui-as-rev__path i { font-style: normal; color: var(--faint); }
.ui-as-rev__path b { font-weight: 500; color: var(--ink); }
.ui-as-rev__actions { display: flex; align-items: center; gap: 6px; }
.ui-as-rev__period { border-radius: calc(var(--aui-radius, 7px) + 2px); }

.ui-as-rev__content { display: flex; flex: 1; flex-direction: column; gap: 12px; padding: 0 16px 16px; }
.ui-as-rev__card {
  padding: 14px 16px;
  border-radius: calc(var(--aui-radius-lg, 10px) + 2px);
  background: var(--card);
  box-shadow: var(--card-shadow);
}
/* Card titles: small and quiet, the figures carry the card */
.ui-as-rev__cap {
  align-self: flex-start;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--muted);
}

.ui-as-rev__stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }

/* The library's Stat Cards with the same edge as the other cards */
.ui-as-rev .ui-statc {
  --ui-statc-shadow: var(--card-shadow);
  border-radius: calc(var(--aui-radius-lg, 10px) + 2px);
}
/* Placeholders while loading: the mini bars' height, and a Trend Chart's plot plus its dates */
.ui-as-rev__stat { --ui-statc-skel-h: 22px; }
.ui-as-rev__chart { --ui-statc-skel-h: 176px; }
/* The chart next to the breakdown fills its card, at a steady minimum height */
.ui-as-rev__chart--tall .ui-statc__body { flex: 1; grid-template-rows: auto minmax(0, 1fr); }
.ui-as-rev__chart--tall .ui-statc__chart { display: flex; flex-direction: column; }
.ui-as-rev__chart--tall .ui-trc { flex: 1; --ui-trc-h: minmax(180px, 1fr); }
.ui-as-rev__chart--tall .ui-statc__skel--chart { flex: 1; min-height: 204px; }

.ui-as-rev__row { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; align-items: stretch; }
/* Every row as tall as its content – on a tall screen the room left over stays below the cards */
.ui-as-rev__row--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.ui-as-rev__breakdown { display: flex; flex-direction: column; }
.ui-as-rev__breakdown ul { display: flex; flex-direction: column; margin: 12px -6px 0; padding: 0; list-style: none; }
.ui-as-rev__breakdown li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 40px;
  align-items: center;
  gap: 12px;
  height: 38px;
  padding: 0 8px;
  border-radius: calc(var(--aui-radius-sm, 5px) + 3px);
  font-size: 13px;
}
.ui-as-rev__breakdown li:nth-child(even) { background: var(--hover); }
.ui-as-rev__breakdown li span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--muted); }
.ui-as-rev__breakdown li b { font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }
.ui-as-rev__spark { width: 40px; height: 14px; overflow: visible; }
.ui-as-rev__spark polyline { fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.ui-as-rev__spark[data-tone="up"] polyline { stroke: var(--aui-success, #1e8a4f); }
.ui-as-rev__spark[data-tone="down"] polyline { stroke: var(--aui-red, #f04438); }
.ui-as-rev__spark[data-tone="flat"] polyline { stroke: var(--faint); }

.ui-as-rev__products { display: flex; flex-direction: column; gap: 14px; }
.ui-as-rev__product { display: flex; flex-direction: column; gap: 7px; }
.ui-as-rev__product > span { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--muted); }
.ui-as-rev__product-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ui-as-rev__product b { flex: none; font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }
.ui-as-rev__product i { display: block; height: 6px; border-radius: 3px; background: var(--aui-blue, #4fb0fe); }

/* Empty: one empty state fills the page under the header; inside a card it sits in the card's middle */
.ui-as-rev__content > .ui-as-empty { flex: 1; justify-content: center; margin-top: 0; }
.ui-as-rev__card > .ui-as-empty[data-bare] { flex: 1; justify-content: center; padding: 20px 0; }

/* Loading: the same cards, rows and chart boxes with gray shapes in place of the figures – nothing moves when the data lands */
.ui-as-rev [data-skel] { pointer-events: none; }
/* A bar centered in the line it stands in for, at that line's own height */
.ui-as-rev__skel-line { display: flex; align-items: center; min-width: 0; height: 1lh; }
}

/* Touch: the header buttons grow to a comfortable 32px */
@media (pointer: coarse) {
  .ui-as-rev__period { min-height: 32px; }
}

/* Room for the sidebar icon on narrow screens, where the sidebar is a drawer */
.ui-as-rev__head { transition: padding-left 420ms var(--ease); }

/* Narrow panels: stat cards 4 → 2, the rows stack */
@container ui-as-main (max-width: 900px) {
  .ui-as-rev__row { grid-template-columns: minmax(0, 1fr); }
  .ui-as-rev__row--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ui-as-rev__row--3 > .ui-as-rev__products { grid-column: 1 / -1; }
}
@container ui-as-main (max-width: 820px) {
  .ui-as-rev__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container ui-as-main (max-width: 560px) {
  .ui-as-rev__row--3 { grid-template-columns: minmax(0, 1fr); }
  .ui-as-rev__stats { gap: 8px; }
}
@container ui-as (max-width: 900px) {
  .ui-as-rev__head { padding-left: 52px; }
}
@container ui-as (max-width: 600px) {
  /* Title next to the sidebar icon, on its centerline (the 20px title in the middle of a head row); the actions on a row below */
  .ui-as-rev__head { flex-wrap: wrap; row-gap: 10px; height: auto; padding: calc((var(--as-head-h, 48px) - 20px) / 2) 8px 12px 52px; }
  .ui-as-rev__path { line-height: 20px; }
  .ui-as-rev__actions { flex-wrap: wrap; gap: 6px 4px; width: calc(100% + 44px); margin-left: -44px; }
  .ui-as-rev__actions > :last-child { margin-left: auto; }
  .ui-as-rev__actions button { white-space: nowrap; }
  .ui-as-rev__content { gap: 8px; padding: 0 8px 8px; }
}
`;
