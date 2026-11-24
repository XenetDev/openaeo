// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * AI Search / Prompt Explorer – what people ask AI assistants, and how often, in a single file.
 * A hero on a soft gradient (blue, cyan and lavender light with a blurred glow under it) asks "Explore what people are
 * prompting ChatGPT"; under the heading a field to type a prompt or keyword. As you type, relevant searches open under it:
 * each completes what you typed (your part bright, the rest quieter) with its monthly prompts and how much that changed.
 * Bulk analysis takes one prompt per line. Analyse adds a card of results – monthly prompts, the change, a year as a
 * sparkline and how often answers mention your brand. Under the hero, Popular keywords and Trending keywords side by side:
 * the change with an arrow and the volume; trending with a sparkline and a switch between rising and falling. A click on
 * a keyword analyses it. Mock data – replace it with your own.
 * Sits in the affectUI App Shell; icons from the Hugeicons free set.
 */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  BubbleChatIcon,
  Cancel01Icon,
  ChartDecreaseIcon,
  ChartIncreaseIcon,
  DashboardSquare01Icon,
  FlashIcon,
  Globe02Icon,
  Link01Icon,
  Search01Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import { PillButton, PillField } from "@/components/pill-field";
import { EmptyState, Icon, Loading, Skeleton, rove, useToast, type AppShellProps, type ShellNavItem } from "@/components/app-shell";

/* ---------- Types ---------- */

/** A prompt or keyword with how many times a month people ask it, and how much that changed since last month */
export type PexKeyword = { id: string; text: string; volume: number; change: number; /** Not measured yet – shown in words, not as 0 */ pending?: boolean; paused?: boolean; /** Small labels after the text */ tags?: string[]; /** Twelve months, oldest first – the sparkline */ trend?: number[] };
/** What Analyse found for one prompt */
export type PexResult = { text: string; volume: number; change: number; pending?: boolean; trend: number[]; /** Share of answers that mention you, 0–1 */ share: number };
export type PexMode = "keyword" | "url";

/* ---------- Sample content – replace with your own data ---------- */

const nav: ShellNavItem[] = [
  { label: "Overview", icon: DashboardSquare01Icon },
  { label: "Answer Engine Insights", icon: FlashIcon },
  { label: "My Website", icon: Globe02Icon },
  { label: "Conversations", icon: BubbleChatIcon },
  { label: "Actions", icon: Target02Icon },
];

/** A twelve-month line that ends at `to`, rising or falling – the same text always draws the same line */
const seeded = (text: string, to: number, change: number) => {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const from = Math.max(1, to - change * 6);
  return Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round(from + ((to - from) * i) / 11 + (rnd() - 0.5) * to * 0.12)));
};
const kw = (text: string, volume: number, change: number): PexKeyword => ({ id: text, text, volume, change, trend: seeded(text, volume, change) });

/** What people ask – the field completes from these */
const samplePrompts: PexKeyword[] = [
  kw("northwind ai visibility", 549_400, 76_200),
  kw("northwind ai", 35_000, -2_700),
  kw("northwind against semrush", 6_400, 1_500),
  kw("northwind pricing", 18_900, 2_100),
  kw("northwind vs semrush", 195_000, 2_100),
  kw("northwind review", 12_300, 900),
  kw("northwind alternatives", 9_800, -400),
  kw("generative ai tools", 135_000, 2_100),
  kw("generative ai", 97_000, 1_800),
  kw("generative engine optimization", 41_200, 6_900),
  kw("geo", 133_000, -2_100),
  kw("geo vs seo", 28_400, 3_300),
  kw("aeo", 120_000, 1_400),
  kw("aeo tools", 22_700, 4_100),
  kw("answer engine optimization", 58_600, 5_200),
  kw("ai search visibility", 47_300, 7_800),
  kw("ai content optimization", 64_000, 6_400),
  kw("ai overviews tracking", 15_600, 2_600),
  kw("google ai overviews", 70_000, 2_900),
  kw("boost ai visibility", 72_000, 3_400),
  kw("best seo tools 2026", 88_100, -5_600),
  kw("seo", 42_000, 7_100),
  kw("seo vs aeo", 108_000, -2_100),
  kw("chatgpt brand mentions", 19_800, 4_400),
  kw("chatgpt rank tracking", 11_400, 2_300),
  kw("perplexity citations", 8_900, 1_900),
];
const samplePopular: PexKeyword[] = [
  kw("Northwind ai", 205_000, 2_100),
  kw("northwind vs semrush", 195_000, 2_100),
  kw("northwind ai visibility", 147_000, 2_100),
  kw("geo", 133_000, -2_100),
  kw("aeo", 131_000, 2_100),
  kw("seo vs aeo", 108_000, -2_100),
  kw("boost ai visibility", 114_000, 2_100),
];
const sampleRising: PexKeyword[] = [
  kw("generative ai tools", 135_000, 2_100),
  kw("aeo", 120_000, 1_400),
  kw("generative ai", 97_000, 1_800),
  kw("boost ai visibility", 72_000, 3_400),
  kw("google ai overviews", 70_000, 2_900),
  kw("ai content optimization", 64_000, 6_400),
  kw("seo", 42_000, 7_100),
];
const sampleFalling: PexKeyword[] = [
  kw("best seo tools 2026", 88_100, -5_600),
  kw("geo", 133_000, -2_100),
  kw("seo vs aeo", 108_000, -2_100),
  kw("northwind ai", 35_000, -2_700),
  kw("keyword research tool", 51_200, -1_900),
  kw("backlink checker", 33_800, -1_400),
  kw("rank tracker", 27_500, -1_100),
];

/* ---------- Numbers ---------- */

/** 549.4k, 35k, 1.2M – volumes never read as "549400" */
const short = (n: number) => (Number.isFinite(n) ? `${Math.round(Math.abs(n))}%` : "–");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${short(n)}`;
const percent = (v: number) => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
/** A made-up but steady answer for a prompt nobody asked yet – the same text always gives the same numbers */
const analyse = (text: string, known: PexKeyword[]): PexResult => {
  const hit = known.find((k) => k.text.toLowerCase() === text.toLowerCase());
  let h = 0;
  for (const c of text) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const volume = hit?.volume ?? 0;
  const change = hit?.change ?? 0;
  return { text, volume, change, trend: hit?.trend ?? [], share: volume / 100 };
};

/* ---------- Small marks ---------- */

/** A year as a thin gray line – quiet, so the numbers beside it lead */
function Sparkline({ values, width = 48, height = 16 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = (v: number) => (hi === lo ? height / 2 : height - 1.5 - ((v - lo) / (hi - lo)) * (height - 3));
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  return (
    <svg className="ui-pex-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
/** The change since last month: an arrow and the amount, green up, red down */
const Change = ({ value, arrow = true }: { value: number; arrow?: boolean }) => (
  <span className="ui-pex-change ui-pex-num" data-dir={value > 0 ? "up" : value < 0 ? "down" : undefined}>
    {arrow && value !== 0 && <Icon icon={value > 0 ? ArrowUp02Icon : ArrowDown02Icon} size={14} stroke={2} />}
    {arrow ? short(value) : signed(value)}
  </span>
);
/** The suggestion with what you typed bright and the rest quieter */
const Completion = ({ text, typed }: { text: string; typed: string }) => {
  const at = typed ? text.toLowerCase().indexOf(typed.toLowerCase()) : -1;
  if (at < 0) return <span className="ui-pex-rest">{text}</span>;
  return (
    <>
      <span className="ui-pex-rest">{text.slice(0, at)}</span>
      <span className="ui-pex-typed">{text.slice(at, at + typed.length)}</span>
      <span className="ui-pex-rest">{text.slice(at + typed.length)}</span>
    </>
  );
};

/* ---------- Screen ---------- */

export type PromptExplorerScreenProps = Pick<AppShellProps, "className"> & {
  /** Buttons shown beside the field, e.g. Suggest questions */
  actions?: ReactNode;
  /** A question in the lists was clicked */
  onOpen?: (text: string) => void;
  /** A line under the field, e.g. what was just added */
  note?: ReactNode;
  /** A menu at the end of each row of Your questions */
  rowMenu?: (k: PexKeyword) => ReactNode;
  /** More cards under the lists, in the same scroll area */
  after?: ReactNode;
  /** The workspace in the sidebar */
  workspace?: string;
  /** The heading over the field */
  title?: ReactNode;
  /** The prompts the field completes from */
  prompts?: PexKeyword[];
  /** The Popular keywords on the left */
  popular?: PexKeyword[];
  /** Trending keywords on the right – rising and falling */
  rising?: PexKeyword[];
  falling?: PexKeyword[];
  /** How Analyse answers – return results for the prompts (one, or one per line in bulk). Left out: made-up numbers */
  onAnalyse?: (prompts: string[], mode: PexMode) => PexResult[] | Promise<PexResult[]>;
  /** Gray rows while the keywords load */
  loading?: boolean;
  /** No keyword data yet – the field still works */
  empty?: boolean;
};

export function PromptExplorerScreen({
  workspace = "Northwind",
  title = "What do your buyers ask AI?",
  prompts = samplePrompts,
  popular = samplePopular,
  rising = sampleRising,
  falling = sampleFalling,
  onAnalyse,
  loading = false,
  empty = false,
  actions,
  note,
  after,
  onOpen,
  rowMenu,
}: PromptExplorerScreenProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<PexMode>("keyword");
  const [bulk, setBulk] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<PexResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [trend, setTrend] = useState<"rising" | "falling">("rising");
  const [toast, showToast] = useToast();
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // In bulk the suggestions follow the line you're on – the last one
  const typed = (bulk ? query.split("\n").pop() ?? "" : query).trim();
  const suggestions = useMemo(() => {
    if (!typed || mode === "url") return [];
    const q = typed.toLowerCase();
    const starts = prompts.filter((p) => p.text.toLowerCase().startsWith(q));
    const has = prompts.filter((p) => !starts.includes(p) && p.text.toLowerCase().includes(q));
    return [...starts, ...has].slice(0, 5);
  }, [typed, prompts, mode]);
  const showList = open && suggestions.length > 0;
  const at = Math.min(active, suggestions.length - 1);

  const run = async (list: string[]) => {
    const clean = list.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return showToast("Type a question first");
    setOpen(false);
    setBusy(true);
    try {
      const out = onAnalyse ? await onAnalyse(clean, mode) : clean.map((t) => analyse(t, prompts));
      setResults(out);
      setQuery("");
    } finally {
      setBusy(false);
    }
  };
  const analyseNow = () => run(bulk ? query.split("\n") : [query]);
  /** A suggestion or a keyword: into the field (on the line you're on in bulk), then analysed */
  const pick = (text: string) => {
    const next = bulk ? [...query.split("\n").slice(0, -1), text].join("\n") : text;
    setQuery(next);
    setOpen(false);
    run(bulk ? next.split("\n") : [text]);
    field.current?.focus();
  };

  const onFieldKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (open ? (i + 1) % suggestions.length : 0));
    } else if (e.key === "ArrowUp" && showList) {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Enter picks the highlighted suggestion, else analyses – in bulk Enter starts a new line and ⌘ + Enter analyses
      if (showList) {
        e.preventDefault();
        pick(suggestions[at].text);
      } else if (!bulk || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        analyseNow();
      }
    }
  };


  const trending = trend === "rising" ? rising : falling;
  const open1 = (text: string) => (onOpen ? onOpen(text) : pick(text));
  const lines = bulk ? query.split("\n").filter((l) => l.trim()).length : 0;

  return (
    <>
      <style href="ui-screen-prompt-explorer" precedence="default">
        {css}
      </style>
      <div className="ui-pex">
        <h1 className="ui-pex-sr">Prompt explorer</h1>

        {/* The hero: a soft gradient with the heading and the field */}
        <section className="oa-audit-hero oa-prompt-hero" aria-labelledby={`${id}-title`}>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>Track the questions people ask AI before they choose a business like yours.</p>

          <PillField
            data-open={showList || undefined}
            icon={Search01Icon}
            label={bulk ? "Questions, one per line" : "A question to track"}
            value={query}
            onChange={(next) => {
              setQuery(next);
              setOpen(true);
              setActive(0);
            }}
            placeholder={bulk ? "One question per line…" : "Type a question a buyer would ask an AI assistant…"}
            fieldRef={field}
            textareaProps={{
              id: `${id}-field`,
              role: "combobox",
              "aria-expanded": showList,
              "aria-controls": `${id}-list`,
              "aria-autocomplete": "list",
              "aria-activedescendant": showList ? `${id}-opt-${at}` : undefined,
              onFocus: () => setOpen(true),
              onBlur: () => window.setTimeout(() => setOpen(false), 120),
              onKeyDown: onFieldKey,
            }}
            action={<PillButton label="Track this question" loading={busy} disabled={!query.trim()} onClick={analyseNow} />}
          >
            {/* Relevant searches: each completes what you typed, with its prompts a month and the change */}
            <div className="ui-pex-list" id={`${id}-list`} role="listbox" aria-label="Relevant searches" hidden={!showList}>
              <p className="ui-pex-list__head" aria-hidden="true">
                Already tracked
              </p>
              {suggestions.map((s, i) => (
                <div
                  key={s.id}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === at}
                  className="ui-pex-opt"
                  onPointerMove={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(s.text)}
                >
                  <span className="ui-pex-opt__text" dir="auto">
                    <Completion text={s.text} typed={typed} />
                  </span>
                  <span className="ui-pex-opt__nums ui-pex-num">
                    {s.pending ? "Not run yet" : <>{short(s.volume)} <Change value={s.change} arrow={false} /></>}
                  </span>
                </div>
              ))}
            </div>
          </PillField>
          <div className="oa-crawlers">
            {actions}
            <button
              type="button"
              className="ui-pex-switch"
              role="switch"
              aria-checked={bulk}
              disabled={mode === "url"}
              onClick={() => {
                setBulk((b) => !b);
                field.current?.focus();
              }}
            >
              <span className="ui-pex-switch__track" aria-hidden="true">
                <i />
              </span>
              Several at once
            </button>
            {bulk && lines > 0 && <span className="ui-pex-count ui-pex-num">{lines === 1 ? "1 question" : `${lines} questions`}</span>}
          </div>
          {note}
        </section>

        {/* Results of Analyse: one row per prompt */}
        {(results || busy) && (
          <section className="ui-pex-card ui-pex-results" aria-label="Analysis" aria-busy={busy || undefined}>
            <header className="ui-pex-card__head">
              <h3>{busy ? "Adding…" : results && results.length > 1 ? `${results.length} questions tracked` : "Now tracked"}</h3>
              {results && !busy && (
                <button type="button" className="ui-as-icon-btn" aria-label="Clear the analysis" onClick={() => setResults(null)}>
                  <Icon icon={Cancel01Icon} size={15} />
                </button>
              )}
            </header>
            <div className="ui-pex-rows">
              <div className="ui-pex-res ui-pex-res--head" aria-hidden="true">
                <span>Question</span>
                <span data-num>Mentioned</span>
                <span data-num>Change</span>
                <span className="ui-pex-res__trend">Recent runs</span>
                <span className="ui-pex-res__share">Latest run</span>
              </div>
              {busy
                ? [0, 1].map((i) => (
                    <div key={i} className="ui-pex-res" data-skel="">
                      <Skeleton width={[220, 160][i]} height={9} />
                      <Skeleton width={44} height={9} />
                      <Skeleton width={40} height={9} />
                      <span className="ui-pex-res__trend">
                        <Skeleton width={72} height={9} />
                      </span>
                      <span className="ui-pex-res__share">
                        <Skeleton width={96} height={6} />
                      </span>
                    </div>
                  ))
                : results!.map((r, i) => (
                    <div key={`${r.text}-${i}`} className="ui-pex-res">
                      <span className="ui-pex-res__text" dir="auto" title={r.text}>
                        {r.text}
                      </span>
                      <span data-num className="ui-pex-num">
                        {r.pending ? "Not run yet" : short(r.volume)}
                      </span>
                      <span data-num>
                        <Change value={r.change} />
                      </span>
                      <span className="ui-pex-res__trend">
                        <Sparkline values={r.trend} width={72} height={18} />
                      </span>
                      <span className="ui-pex-res__share" title={`${percent(r.share)} of answers to this prompt mention ${workspace}`}>
                        <span className="ui-pex-meter" aria-hidden="true">
                          <i style={{ width: percent(r.share) }} />
                        </span>
                        <span className="ui-pex-num">{r.pending ? "–" : percent(r.share)}</span>
                      </span>
                    </div>
                  ))}
            </div>
          </section>
        )}

        {/* Popular and trending keywords, side by side */}
        <section className="ui-pex-card ui-pex-split" aria-label="Keywords">
          <div className="ui-pex-col">
            <header className="ui-pex-col__head">
              <h3>Your questions</h3>
            </header>
            <KeywordList items={popular} loading={loading} empty={empty} label="Your questions" onPick={open1} rowMenu={rowMenu} />
          </div>
          <div className="ui-pex-col">
            <header className="ui-pex-col__head">
              <h3>Movers since the last run</h3>
              <div className="ui-pex-modes ui-pex-modes--trend" role="radiogroup" aria-label="Trend" onKeyDown={(e) => rove(e, ["rising", "falling"] as const, trend, setTrend)}>
                {(
                  [
                    ["rising", "Rising", ChartIncreaseIcon],
                    ["falling", "Falling", ChartDecreaseIcon],
                  ] as const
                ).map(([t, label, icon]) => (
                  <button key={t} type="button" role="radio" aria-checked={trend === t} aria-label={label} data-tip={label} data-dir={t} tabIndex={trend === t ? 0 : -1} onClick={() => setTrend(t)}>
                    <Icon icon={icon} size={16} />
                  </button>
                ))}
              </div>
            </header>
            <KeywordList items={trending} loading={loading} empty={empty} label={`${trend === "rising" ? "Rising" : "Falling"} keywords`} spark none={trend === "rising" ? "Nothing improved since the last run" : "Nothing dropped since the last run"} onPick={open1} />
          </div>
        </section>
        {after}
        {toast}
      </div>
    </>
  );
}

/** Keywords as rows: the keyword, maybe its year as a sparkline, the change and the volume – a click analyses it */
function KeywordList({ items, loading, empty, label, spark, none, onPick, rowMenu }: { rowMenu?: (k: PexKeyword) => ReactNode; items: PexKeyword[]; loading?: boolean; empty?: boolean; label: string; spark?: boolean; /** What an empty list says while there is data elsewhere */ none?: string; onPick: (text: string) => void }) {
  if (loading)
    return (
      <Loading label={`Loading ${label.toLowerCase()}`} className="ui-pex-kws">
        {[180, 140, 200, 120, 160, 110, 150].map((w, i) => (
          <div key={i} className="ui-pex-kw" data-skel="" data-spark={spark || undefined}>
            <Skeleton width={w} height={10} />
            {spark && <Skeleton width={48} height={8} />}
            <Skeleton width={44} height={10} />
            <Skeleton width={36} height={10} />
          </div>
        ))}
      </Loading>
    );
  if (empty && none) return <EmptyState bare icon={ChartIncreaseIcon} title="Nothing to compare yet" text="After two runs, this shows which questions you gained or lost ground on." />;
  if (empty || !items.length) return empty || !none ? <EmptyState bare icon={Search01Icon} title="No questions yet" text="Type a question above. After a run, each one shows how often AI answers mention you." /> : <EmptyState bare icon={ChartIncreaseIcon} title={none} text="Run again after making changes to see what moved." />;
  return (
    <ul className="ui-pex-kws" aria-label={label}>
      {items.map((k) => (
        <li key={k.id} className={rowMenu ? "oa-kwrow" : undefined} data-paused={k.paused || undefined}>
          <button type="button" className="ui-pex-kw" data-spark={spark || undefined} aria-label={`${k.text}, ${short(k.volume)} of answers mention you${k.pending ? " (not run yet)" : ""}, ${k.change >= 0 ? "up" : "down"} ${short(k.change)} – analyse`} onClick={() => onPick(k.text)}>
            <span className="ui-pex-kw__text" dir="auto" title={k.text}>
              {k.text}
              {k.tags?.map((tag) => (
                <i key={tag} className="oa-kwtag">
                  {tag}
                </i>
              ))}
            </span>
            {spark && <Sparkline values={k.trend ?? []} />}
            {k.change !== 0 ? <Change value={k.change} /> : <span />}
            <span className="ui-pex-kw__vol ui-pex-num">{k.paused ? "Paused" : k.pending ? "Not run yet" : short(k.volume)}</span>
          </button>
          {rowMenu?.(k)}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Styles ---------- */

/** The Figma gradient's blurred glow, small – it's soft anyway, so 256px wide is plenty */
const GLOW = "data:image/jpeg;base64,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";

const css = /* css */ `
.ui-pex {
  --ui-pex-focus: var(--aui-focus, rgba(0, 96, 226, 0.7));
  --pex-up: var(--aui-green, #12a150);
  --pex-down: var(--aui-red, #e5484d);
  --pex-hero-ink: rgba(0, 0, 0, 0.88);
  --pex-box: var(--card);
  --pex-float: 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.06), 0 16px 40px -12px rgba(40, 60, 140, 0.18);
  --pex-on: var(--aui-blue, #0a84ff);
  --mono: var(--aui-font-mono, ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
  padding: 12px 12px 24px;
  /* The hero fades out downward – what follows starts in its fade */
}
:where(.dark, [data-theme="dark"]) .ui-pex {
  --ui-pex-focus: var(--aui-focus, rgba(77, 141, 255, 0.8));
  --pex-up: #3dd68c;
  --pex-down: #ff6369;
  --pex-hero-ink: rgba(255, 255, 255, 0.94);
  --pex-box: #1c1c1f;
  --pex-float: 0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 16px 40px -12px rgba(0, 0, 0, 0.6);
}
.ui-pex > * { flex: none; }
.ui-pex-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ui-pex-num { font-variant-numeric: tabular-nums; }

/* The hero: the Figma gradient in its order – #eef2ff, blue and cyan light over white, the blurred glow, a lavender veil on
   top – in one layer that fades out downward into the page, as in the reference; the hero itself lets the searches hang out */
.ui-pex-hero { position: relative; isolation: isolate; display: grid; justify-items: center; gap: 28px; padding: 72px 24px 88px; }
.ui-pex-hero__bg { position: absolute; inset: 0; z-index: -1; overflow: hidden; contain: paint; transform: translateZ(0); border-radius: calc(var(--aui-radius-lg, 10px) + 2px) calc(var(--aui-radius-lg, 10px) + 2px) 0 0; background: #eef2ff; pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 50%, transparent 94%); mask-image: linear-gradient(180deg, #000 0%, #000 50%, transparent 94%); }
.ui-pex-hero__bg::before { content: ""; position: absolute; inset: -20%; opacity: 0.7; will-change: transform; backface-visibility: hidden; animation: ui-pex-drift-a 9s ease-in-out infinite alternate; background:
    radial-gradient(72% 90% at 12% 66%, rgba(92, 157, 238, 0.7) 0%, rgba(92, 157, 238, 0) 72%),
    radial-gradient(62% 78% at 86% 62%, rgba(106, 217, 232, 0.52) 0%, rgba(106, 217, 232, 0) 74%),
    linear-gradient(180deg, #ffffff 8%, #f8faf9 100%); }
.ui-pex-hero__bg > i { position: absolute; inset: -46% -12% 6% -12%; opacity: 0.85; will-change: transform; backface-visibility: hidden; background: url("${GLOW}") center bottom / cover no-repeat; -webkit-mask-image: radial-gradient(closest-side, #000 45%, transparent 100%); mask-image: radial-gradient(closest-side, #000 45%, transparent 100%); animation: ui-pex-drift-b 11s ease-in-out infinite alternate; }
.ui-pex-hero__bg::after { content: ""; position: absolute; inset: -20%; will-change: transform; backface-visibility: hidden; animation: ui-pex-drift-c 13s ease-in-out infinite alternate; background:
    radial-gradient(120% 120% at 85% 85%, rgba(221, 201, 255, 0.72) 0%, rgba(221, 201, 255, 0) 65%),
    radial-gradient(116% 116% at 12% 25%, rgba(210, 231, 255, 0.55) 0%, rgba(210, 231, 255, 0) 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(238, 227, 255, 0.22) 100%); }
/* Dark: the same light, turned to night – the glow inverted with its colours kept */
:where(.dark, [data-theme="dark"]) .ui-pex-hero__bg { background: #131527; }
:where(.dark, [data-theme="dark"]) .ui-pex-hero__bg::before { opacity: 0.8; background:
    radial-gradient(72% 90% at 12% 66%, rgba(70, 120, 230, 0.55) 0%, rgba(70, 120, 230, 0) 72%),
    radial-gradient(62% 78% at 86% 62%, rgba(60, 170, 200, 0.32) 0%, rgba(60, 170, 200, 0) 74%),
    linear-gradient(180deg, #14162a 8%, #181a2e 100%); }
:where(.dark, [data-theme="dark"]) .ui-pex-hero__bg > i { opacity: 1; background:
    radial-gradient(46% 58% at 50% 78%, rgba(96, 124, 255, 0.34) 0%, rgba(96, 124, 255, 0) 100%),
    radial-gradient(34% 44% at 30% 70%, rgba(72, 176, 214, 0.2) 0%, rgba(72, 176, 214, 0) 100%),
    radial-gradient(34% 44% at 72% 72%, rgba(150, 110, 240, 0.22) 0%, rgba(150, 110, 240, 0) 100%); }
:where(.dark, [data-theme="dark"]) .ui-pex-hero__bg::after { background:
    radial-gradient(120% 120% at 85% 85%, rgba(120, 90, 220, 0.4) 0%, rgba(120, 90, 220, 0) 65%),
    radial-gradient(116% 116% at 12% 25%, rgba(60, 90, 190, 0.3) 0%, rgba(60, 90, 190, 0) 60%),
    linear-gradient(180deg, rgba(12, 14, 34, 0.2) 0%, rgba(40, 30, 80, 0.25) 100%); }
.ui-pex-title { max-width: 520px; margin: 0; font-size: 28px; font-weight: 500; line-height: 36px; letter-spacing: -0.28px; text-align: center; text-wrap: balance; color: var(--pex-hero-ink); }

/* The field: one white card – the text, a bar with the mode, Bulk analysis and Analyse, and the suggestions under a hairline */
.ui-pex-box { position: relative; z-index: 4; width: min(100%, 600px); border-radius: var(--aui-radius-lg, 10px); background: var(--pex-box); box-shadow: var(--pex-float); transition: box-shadow 160ms ease; }
.ui-pex-box:focus-within, .ui-pex-box[data-open] { box-shadow: 0 0 0 1px var(--line-strong), var(--pex-float); }
.ui-pex-field { display: block; width: 100%; min-height: 44px; max-height: 156px; margin: 0; padding: 14px 16px 4px; border: 0; outline: none; resize: none; background: none; font: inherit; font-size: 14px; line-height: 20px; color: var(--ink); }
.ui-pex-field::placeholder { color: var(--placeholder, var(--faint)); }
.ui-pex-bar { display: flex; align-items: center; gap: 12px; padding: 8px 10px 10px 12px; }
.ui-pex-bar__gap { flex: 1; }
.ui-pex-count { font-size: 12px; color: var(--muted); }
/* Two options as icons – only the picked one filled, no frame around the group */
.ui-pex-modes { display: flex; gap: 2px; }
.ui-pex-modes button { position: relative; display: grid; place-items: center; width: 28px; height: 28px; border-radius: calc(var(--aui-radius, 7px) - 1px); color: var(--faint); transition: background-color 140ms ease, color 140ms ease; }
.ui-pex-modes button:hover { color: var(--ink); }
.ui-pex-modes button[aria-checked="true"] { background: var(--chip); color: var(--ink); }
.ui-pex-modes--trend button { width: 32px; }
.ui-pex-modes--trend button[aria-checked="true"][data-dir="rising"] { color: var(--pex-up); }
.ui-pex-modes--trend button[aria-checked="true"][data-dir="falling"] { color: var(--pex-down); }
.ui-pex [data-tip]:hover::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 6px); left: 50%; translate: -50% 0; z-index: 3; padding: 3px 7px; border-radius: 6px; background: rgba(0, 0, 0, 0.86); font-size: 12px; font-weight: 500; line-height: 16px; white-space: nowrap; color: #fff; pointer-events: none; }
/* Bulk analysis: a small switch with its words */
.ui-pex-switch { display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 4px; border-radius: calc(var(--aui-radius, 7px) - 1px); font-size: 13px; color: var(--text); }
.ui-pex-switch:disabled { opacity: 0.45; cursor: not-allowed; }
.ui-pex-switch__track { position: relative; width: 30px; height: 18px; border-radius: 9px; background: var(--line-strong); transition: background-color 160ms ease; }
.ui-pex-switch__track i { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: translate 180ms var(--ease); }
.ui-pex-switch[aria-checked="true"] .ui-pex-switch__track { background: var(--pex-on); }
.ui-pex-switch[aria-checked="true"] .ui-pex-switch__track i { translate: 12px 0; }
.ui-pex-go { height: 28px; padding: 0 10px; border-radius: calc(var(--aui-radius, 7px) - 1px); background: var(--aui-primary, var(--ink)); font-size: 13px; font-weight: 500; color: var(--aui-on-primary, var(--card)); transition: filter 140ms ease; }
.ui-pex-go:hover { filter: brightness(1.15); }
.ui-pex-go[aria-busy] { opacity: 0.7; }
/* The searches drop over what's below, joined to the field's card – nothing moves while you type */
.ui-pex-list { position: absolute; top: calc(100% + 1px); left: 0; right: 0; padding: 6px; border-radius: 0 0 var(--aui-radius-lg, 10px) var(--aui-radius-lg, 10px); background: var(--pex-box); box-shadow: 0 0 0 1px var(--line-strong), 0 20px 40px -16px rgba(20, 30, 80, 0.28); clip-path: inset(0 -48px -64px -48px); }
.ui-pex-box[data-open] { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.ui-pex-list[hidden] { display: none; }
.ui-pex-list__head { margin: 0; padding: 8px 10px 6px; font-size: 12px; color: var(--muted); }
.ui-pex-opt { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 34px; padding: 0 10px; border-radius: calc(var(--aui-radius, 7px) - 1px); font-size: 13px; cursor: pointer; }
.ui-pex-opt[aria-selected="true"] { background: var(--hover); }
.ui-pex-opt__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ui-pex-typed { color: var(--ink); }
.ui-pex-rest { color: var(--muted); }
.ui-pex-opt__nums { flex: none; display: inline-flex; gap: 6px; font-size: 13px; color: var(--ink); }

/* Change: green up, red down – the only colour besides the hero */
.ui-pex-change { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--muted); }
.ui-pex-change[data-dir="up"] { color: var(--pex-up); }
.ui-pex-change[data-dir="down"] { color: var(--pex-down); }

/* Cards under the hero */
.ui-pex-card { border-radius: var(--aui-radius-lg, 10px); background: var(--card); box-shadow: var(--card-shadow); }
.ui-pex-card h3 { margin: 0; font-size: 15px; font-weight: 500; line-height: 24px; color: var(--strong); }
.ui-pex-card__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px 4px 20px; }
.ui-pex-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ui-pex-col { min-width: 0; padding: 16px 20px 10px; }
.ui-pex-col + .ui-pex-col { box-shadow: inset 0.5px 0 0 var(--line-strong); }
.ui-pex-col__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; margin-bottom: 8px; }
.ui-pex-col .ui-as-empty[data-bare] { padding: 32px 8px; }
.ui-pex-kws { display: grid; margin: 0 -8px; padding: 0; list-style: none; }
.ui-pex-kws > li + li, .ui-pex-kws > .ui-pex-kw + .ui-pex-kw { box-shadow: inset 0 0.5px 0 var(--line); }
.ui-pex-kw { display: grid; grid-template-columns: minmax(0, 1fr) max-content 52px; align-items: center; gap: 16px; width: 100%; height: 44px; padding: 0 8px; border-radius: calc(var(--aui-radius, 7px) - 1px); font-size: 13px; text-align: left; color: var(--ink); transition: background-color 120ms ease; }
.ui-pex-kw[data-spark] { grid-template-columns: minmax(0, 1fr) 56px 72px 52px; }
button.ui-pex-kw:hover { background: var(--hover); }
button.ui-pex-kw:focus-visible { outline-offset: -2px; }
.ui-pex-kw__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ui-pex-kw__vol { text-align: right; white-space: nowrap; color: var(--ink); }
.ui-pex-kw[data-skel] > :nth-child(n + 2) { justify-self: end; }
.ui-pex-spark { justify-self: center; overflow: visible; }
.ui-pex-spark path { fill: none; stroke: var(--faint); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }

/* Analysis: one row per prompt */
.ui-pex-results { animation: ui-pex-rise 320ms var(--ease) both; }
.ui-pex-rows { padding: 0 12px 8px; }
.ui-pex-res { display: grid; grid-template-columns: minmax(0, 1fr) 96px 80px 96px 150px; align-items: center; gap: 16px; height: 44px; padding: 0 8px; font-size: 13px; color: var(--ink); }
.ui-pex-res + .ui-pex-res { box-shadow: inset 0 0.5px 0 var(--line); }
.ui-pex-res--head { height: 28px; font-size: 10px; font-weight: 500; line-height: 16px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--muted); }
.ui-pex-res [data-num] { text-align: right; justify-self: end; }
.ui-pex-res__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ui-pex-res__trend { justify-self: center; }
.ui-pex-res__share { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text); }
.ui-pex-res--head > span { font-size: 10px; color: var(--muted); }
.ui-pex-meter { flex: 1; height: 6px; overflow: hidden; border-radius: 3px; background: var(--chip); }
.ui-pex-meter i { display: block; height: 100%; border-radius: 3px; background: var(--pex-on); transition: width 600ms var(--ease); }

.ui-pex [data-skel] { pointer-events: none; }
.ui-pex > .ui-as-toast { position: fixed; }
@keyframes ui-pex-rise { from { opacity: 0; transform: translateY(6px); } }

/* Narrower: the columns stack, the hero and its heading shrink, the result rows drop their year and share */
@container ui-as (max-width: 860px) {
  .ui-pex-split { grid-template-columns: minmax(0, 1fr); }
  .ui-pex-col + .ui-pex-col { box-shadow: inset 0 0.5px 0 var(--line-strong); }
  .ui-pex-res { grid-template-columns: minmax(0, 1fr) 80px 70px; }
  .ui-pex-res__trend, .ui-pex-res__share { display: none; }
}
@container ui-as (max-width: 900px) {
  .ui-pex { padding-top: 56px; }
}
@container ui-as (max-width: 560px) {
  .ui-pex { padding: 52px 8px 16px; gap: 12px; }
  .ui-pex-hero { gap: 22px; padding: 40px 12px 16px; }
  .ui-pex-title { font-size: 22px; line-height: 28px; }
  .ui-pex-title br { display: none; }
  .ui-pex-field { font-size: 16px; }
  .ui-pex-bar { flex-wrap: wrap; gap: 8px; }
  .ui-pex-col { padding: 14px 14px 8px; }
  .ui-pex-kw, .ui-pex-kw[data-spark] { grid-template-columns: minmax(0, 1fr) 64px 48px; height: 44px; }
  .ui-pex-kw .ui-pex-spark { display: none; }
  .ui-pex-kw[data-skel][data-spark] > :nth-child(2) { display: none; }
}
@media (pointer: coarse) {
  .ui-pex-modes button, .ui-pex-switch, .ui-pex-go { min-height: 36px; min-width: 36px; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-pex-results, .ui-pex-switch__track i, .ui-pex-meter i { animation: none; transition: none; }
}

/* The hero's light drifts: each layer on its own slow loop, so the colours keep shifting without ever repeating the same frame */
@keyframes ui-pex-drift-a { 0% { transform: translate(-12%, 4%) scale(1); } 50% { transform: translate(6%, -6%) scale(1.1); } 100% { transform: translate(12%, 5%) scale(0.96); } }
@keyframes ui-pex-drift-b { 0% { transform: translate(9%, 3%) scale(1.04) rotate(0deg); } 50% { transform: translate(-9%, -5%) scale(1.16) rotate(6deg); } 100% { transform: translate(-3%, 7%) scale(1) rotate(-5deg); } }
@keyframes ui-pex-drift-c { 0% { transform: translate(10%, -5%) scale(1.02); } 50% { transform: translate(-10%, 6%) scale(1.12); } 100% { transform: translate(5%, 3%) scale(0.98); } }
@media (prefers-reduced-motion: reduce) {
  .ui-pex-hero__bg::before, .ui-pex-hero__bg::after, .ui-pex-hero__bg > i { animation: none; }
}
`;
