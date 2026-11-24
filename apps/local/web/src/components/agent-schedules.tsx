// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * Schedules – what your agent does on its own, again and again, in a single file.
 * On top, the hours around now as a live chart of how busy the agent is: a line with a soft fill up to now, its head a
 * glowing point; every run a marker in its project's color (red when it failed), the coming ones dashed, over a few quiet
 * horizontal lines. When a run starts the line climbs at the head and a chip beside it says what's running – and the line
 * under the chart says it too: "Running now: Competitor scan · 38%", or what's next and when.
 * Under it, the schedules: each one row with its name and its rhythm in words ("Every weekday at 7:45"), when it
 * runs next, how the last run ended (Done, Needs you, Failed), what a run costs, and a switch to pause it.
 * A schedule opens on the right, in the App Shell's work area: what it does, its next runs – each one can be skipped –
 * the last ones with how they ended, and Run now (it shows up on the line at once) and Pause.
 * Keyboard: J / K move from schedule to schedule, Enter opens, Space pauses or resumes the focused one.
 * Focus rings show for the keyboard only.
 * Parts kept apart for reuse: Timeline, ScheduleRow, Switch and SchedulePanel.
 * Sits in the affectUI App Shell; icons from the Hugeicons free set.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Analytics01Icon,
  ArrowTurnBackwardIcon,
  Brain02Icon,
  Calendar03Icon,
  CheckListIcon,
  InboxIcon,
  Message01Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  Settings01Icon,
  Shield01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { AppShell, EmptyState, Icon, Loading, Skeleton, useWorkArea, type AppShellProps, type ShellGroup, type ShellNavItem } from "@/components/app-shell";

/* ---------- Types ---------- */

export type RunOutcome = "done" | "needs" | "failed";
export type Schedule = {
  id: string;
  name: string;
  /** Its project – the color of its mark */
  project?: string;
  /** A palette name (orange, purple, teal, blue, amber, pink, green) or any CSS color */
  tone?: string;
  /** What it does, in words – the brief it runs with */
  prompt?: string;
  /** Its rhythm in words – "Every weekday at 7:45" */
  cadence: string;
  /** When it runs – past and coming times in ms; the line shows the ones around now, the panel the next ones */
  runs: number[];
  /** How long a run usually takes, in ms – the ring fills over it */
  duration?: number;
  paused?: boolean;
  /** How its last runs ended, newest first */
  history?: { at: number; outcome: RunOutcome; summary: string; cost?: number }[];
  /** What a run costs, on average */
  cost?: number;
};

/* ---------- Sample content – replace with your own data ---------- */

const nav: ShellNavItem[] = [
  { label: "Thread", icon: Message01Icon },
  { label: "Inbox", icon: InboxIcon, count: 5 },
  { label: "Tasks", icon: CheckListIcon },
  { label: "Memory", icon: Brain02Icon },
];
const groups: ShellGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Schedules", icon: Calendar03Icon },
      { label: "Activity", icon: Task01Icon },
      { label: "Usage", icon: Analytics01Icon },
      { label: "Permissions", icon: Shield01Icon },
      { label: "Settings", icon: Settings01Icon },
    ],
  },
];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Clock times for the sample – real ones, so the rhythm in words matches the times shown */
const atClock = (h: number, m: number, dayOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
/** The next few times a daily rhythm hits, around now – on the days `ok` allows */
const daily = (h: number, m: number, ok: (day: number) => boolean = () => true, back = 1, ahead = 4) => {
  const out: number[] = [];
  for (let d = -7; d <= 14 && out.filter((t) => t > Date.now()).length < ahead; d++) {
    const t = atClock(h, m, d);
    if (ok(new Date(t).getDay())) out.push(t);
  }
  const past = out.filter((t) => t <= Date.now()).slice(-back);
  return [...past, ...out.filter((t) => t > Date.now())];
};
const weekdays = (day: number) => day >= 1 && day <= 5;
const clockHM = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", hour12: false });
const dayName = new Intl.DateTimeFormat("en", { weekday: "long" });

export const makeSampleSchedules = (): Schedule[] => {
  const now = Date.now();
  // The scan runs a few seconds after you look – its rhythm is said from that time
  const scanAt = now + 6_000;
  // Every two hours, on the even hours from 8 to 20
  const triage: number[] = [];
  for (let d = 0; d <= 1; d++) for (let h = 8; h <= 20; h += 2) triage.push(atClock(h, 0, d));
  const firstOfMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  })();
  const nextFriday = daily(16, 0, (day) => day === 5, 1, 2);
  const lastRun = (runs: number[]) => runs.filter((t) => t <= now).pop() ?? now - 7 * DAY;
  const numbers = daily(7, 45, weekdays);
  const standup = daily(16, 30, weekdays);
  const evals = daily(2, 0);
  return [
    {
      id: "scan",
      name: "Competitor scan",
      project: "Northwind",
      tone: "orange",
      prompt: "Check the nine makers' sites and shops for new prices, models and campaigns – and tell me what changed since last week.",
      cadence: `Every ${dayName.format(scanAt)} at ${clockHM.format(scanAt)}`,
      runs: [scanAt - 7 * DAY, scanAt, scanAt + 7 * DAY],
      duration: 9_000,
      cost: 3.1,
      history: [
        { at: scanAt - 7 * DAY, outcome: "done", summary: "2 makers cut prices, 1 new model", cost: 3.42 },
        { at: scanAt - 14 * DAY, outcome: "done", summary: "Nothing changed", cost: 2.8 },
        { at: scanAt - 21 * DAY, outcome: "failed", summary: "Three shops blocked the browser", cost: 1.2 },
      ],
    },
    {
      id: "triage",
      name: "Inbox triage",
      project: "Platform",
      tone: "purple",
      prompt: "Sort new support emails: answer the easy ones, label the rest and put anything urgent in my Inbox.",
      cadence: "Every 2 hours, 8:00 – 20:00",
      runs: triage,
      duration: 2 * MIN,
      cost: 0.18,
      history: [
        { at: lastRun(triage), outcome: "done", summary: "Answered 6, labeled 11", cost: 0.21 },
        { at: lastRun(triage) - 2 * HOUR, outcome: "needs", summary: "1 refund over 50 € waits for you", cost: 0.16 },
      ],
    },
    {
      id: "numbers",
      name: "Northwind numbers",
      project: "Northwind",
      tone: "orange",
      prompt: "Refresh the client dashboard so it's ready before their team opens it at 8:30.",
      cadence: "Every weekday at 7:45",
      runs: numbers,
      duration: 4 * MIN,
      cost: 0.42,
      history: [{ at: lastRun(numbers), outcome: "done", summary: "Dashboard ready 4 minutes later", cost: 0.4 }],
    },
    {
      id: "standup",
      name: "Standup notes",
      project: "Platform",
      tone: "purple",
      prompt: "Collect what moved since yesterday from GitHub and Slack and post a short note in #platform.",
      cadence: "Every weekday at 16:30",
      runs: standup,
      duration: 3 * MIN,
      cost: 0.26,
      history: [{ at: lastRun(standup), outcome: "done", summary: "Posted in #platform", cost: 0.24 }],
    },
    {
      id: "weekly",
      name: "Weekly update",
      project: "Northwind",
      tone: "orange",
      prompt: "Draft the weekly update for Priya – what shipped, what needs her answer – and ask me before sending it.",
      cadence: "Every Friday at 16:00",
      runs: nextFriday,
      cost: 0.55,
      history: [{ at: lastRun(nextFriday), outcome: "needs", summary: "Draft waits for your OK", cost: 0.51 }],
    },
    {
      id: "evals",
      name: "Nightly evals",
      project: "Evalkit",
      tone: "teal",
      prompt: "Run the benchmark suite on the latest build and post the scores.",
      cadence: "Every night at 2:00",
      runs: evals,
      paused: true,
      cost: 4.8,
      history: [{ at: lastRun(evals), outcome: "done", summary: "Scores up 1.2 on average", cost: 5.1 }],
    },
    {
      id: "invoices",
      name: "Invoice reminders",
      project: "Internal",
      tone: "gray",
      prompt: "Remind clients whose invoices are more than 14 days late – politely, once.",
      cadence: "On the 1st of every month",
      runs: [firstOfMonth],
      cost: 0.3,
      history: [{ at: firstOfMonth - 31 * DAY, outcome: "failed", summary: "Stripe didn't answer – try again", cost: 0.02 }],
    },
  ];
};
export const sampleSchedules = makeSampleSchedules();

/* ---------- Labels and formats ---------- */

const defaultLabels = {
  schedules: "Schedules",
  aroundNow: "Around now",
  now: "Now",
  runningNow: "Running now",
  next: "Next",
  nothingNext: "Nothing else in the next 8 hours",
  more: "Show all",
  less: "Show less",
  activity: "Agent activity",
  perTen: "actions / 10 min",
  perTenOne: "action / 10 min",
  paused: "Paused",
  pause: "Pause",
  resume: "Resume",
  runNow: "Run now",
  skip: "Skip",
  skipped: "Skipped",
  restore: "Restore",
  nextRuns: "Next runs",
  lastRuns: "Last runs",
  perRun: "per run",
  what: "What it does",
  done: "Done",
  needs: "Needs you",
  failed: "Failed",
  noRuns: "No runs yet",
  noSchedule: "Nothing open",
  noScheduleText: "Pick a schedule to see its next runs and how the last ones went.",
  empty: "No schedules yet",
  emptyText: "Ask your agent in the Thread to do something every day, week or month – it shows up here.",
  emptyAction: "Ask in Thread",
};
export type ScheduleLabels = Partial<typeof defaultLabels>;
type Labels = typeof defaultLabels;
const NO_LABELS: ScheduleLabels = {};

const TONES: Record<string, string> = {
  purple: "var(--ags-c-purple)",
  orange: "var(--ags-c-orange)",
  teal: "var(--ags-c-teal)",
  blue: "var(--ags-c-blue)",
  amber: "var(--ags-c-amber)",
  pink: "var(--ags-c-pink)",
  green: "var(--ags-c-green)",
  gray: "var(--ags-c-gray)",
};
const toneOf = (t?: string) => (t ? (TONES[t] ?? t) : TONES.gray);
const clock = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false });
const weekday = new Intl.DateTimeFormat("en", { weekday: "short" });
const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
/** In the row's narrow column: €1.3K */
const moneyShort = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });
const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0);
/** "Today 14:00", "Tomorrow 7:45", "Fri 16:00", "Nov 30 9:00" */
const whenText = (t: number, now: number) => {
  const days = Math.round((startOf(t) - startOf(now)) / DAY);
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : Math.abs(days) < 7 ? weekday.format(t) : monthDay.format(t);
  return `${day} ${clock.format(t)}`;
};
/** "in 52 min", "in 3 h", "in 2 days" – and "3 h ago" */
const relText = (t: number, now: number) => {
  const m = Math.round((t - now) / MIN);
  const a = Math.abs(m);
  const s = a < 1 ? "now" : a < 60 ? `${a} min` : a < 48 * 60 ? `${Math.round(a / 60)} h` : `${Math.round(a / 1440)} days`;
  // Under a minute: still to come is "in a moment", just gone is "just now"
  if (a < 1) return t > now ? "in a moment" : "just now";
  return m > 0 ? `in ${s}` : `${s} ago`;
};
const isTyping = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);

/* ---------- Screen ---------- */

export type AgentSchedulesScreenProps = Pick<AppShellProps, "onNavigate" | "user" | "className"> & {
  workspace?: string;
  /** Every schedule. Pass a stable array (state): the screen follows it */
  schedules?: Schedule[];
  /** The schedule open on the right when the screen starts */
  defaultSelected?: string | null;
  /** Called when a schedule is paused or resumed */
  onPause?: (id: string, paused: boolean) => void;
  /** Called with Run now – the screen shows the run on the line at once */
  onRunNow?: (id: string) => void;
  /** Called when a coming run is skipped or restored */
  onSkip?: (id: string, at: number, skipped: boolean) => void;
  onSelect?: (id: string) => void;
  labels?: ScheduleLabels;
  /** While your schedules load: a gray chart, gray rows and a gray Schedule panel, in the shape of the real ones */
  loading?: boolean;
  /** No schedules at all: the page shows No schedules yet with an Ask in Thread button, the Schedule panel nothing open, the clock rests */
  empty?: boolean;
};

const NO_SCHEDULES: Schedule[] = [];

export function AgentSchedulesScreen({
  workspace = "Fieldwork",
  schedules: list = sampleSchedules,
  defaultSelected = "scan",
  onPause,
  onRunNow,
  onSkip,
  onSelect,
  labels: labelProp = NO_LABELS,
  loading,
  empty = false,
  onNavigate,
  ...props
}: AgentSchedulesScreenProps) {
  const labels = useMemo(() => ({ ...defaultLabels, ...labelProp }), [labelProp]);
  // Empty: no schedules at all – the count, the chart, the panel and the clock follow from the one empty list
  const source = empty && !loading ? NO_SCHEDULES : list;
  const [items, setItems] = useState(source);
  useEffect(() => setItems(source), [source]);
  const [selected, setSelected] = useState<string | null>(defaultSelected);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // The clock: every second while a run is going or about to, every 20 seconds otherwise
  const busy = !loading && items.some((s) => !s.paused && s.runs.some((t) => t > now - (s.duration ?? 0) && t < now + 30_000));
  useEffect(() => {
    // Every frame while a run goes or is about to – the line climbs smoothly – every 20 seconds otherwise
    if (loading) return;
    if (!busy) {
      const t = window.setInterval(() => setNow(Date.now()), 20_000);
      return () => window.clearInterval(t);
    }
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (ts - last > 50) {
        last = ts;
        setNow(Date.now());
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [busy, loading]);
  const announce = (text: string) => {
    setSaid("");
    window.setTimeout(() => setSaid(text), 30);
  };

  const skipKey = (id: string, t: number) => `${id}@${t}`;
  const nextOf = (s: Schedule) => (s.paused ? undefined : s.runs.filter((t) => t > now && !skipped.includes(skipKey(s.id, t))).sort((a, b) => a - b)[0]);
  const sorted = [...items].sort((a, b) => (nextOf(a) ?? Infinity) - (nextOf(b) ?? Infinity));
  const schedule = items.find((s) => s.id === selected) ?? null;

  const setPaused = (id: string, paused: boolean) => {
    const s = items.find((x) => x.id === id);
    if (!s) return;
    setItems((l) => l.map((x) => (x.id === id ? { ...x, paused } : x)));
    announce(`${s.name}: ${paused ? labels.paused : labels.resume}`);
    onPause?.(id, paused);
  };
  const runNow = (id: string) => {
    const s = items.find((x) => x.id === id);
    if (!s) return;
    const t = Date.now();
    setItems((l) => l.map((x) => (x.id === id ? { ...x, runs: [...x.runs, t], duration: x.duration ?? 8_000 } : x)));
    setNow(t);
    announce(`${s.name}: ${labels.runningNow}`);
    onRunNow?.(id);
  };
  const toggleSkip = (id: string, t: number) => {
    const k = skipKey(id, t);
    const was = skipped.includes(k);
    setSkipped((l) => (was ? l.filter((x) => x !== k) : [...l, k]));
    onSkip?.(id, t, !was);
  };

  const ws = useWorkArea({
    tabs: [
      {
        id: "schedule",
        title: (!loading && schedule?.name) || labels.schedules,
        icon: RepeatIcon,
        content: loading ? (
          <SchedulePanelSkeleton labels={labels} />
        ) : schedule ? (
          <SchedulePanel
            key={schedule.id}
            schedule={schedule}
            now={now}
            skipped={skipped}
            skipKey={skipKey}
            labels={labels}
            onPause={(p) => setPaused(schedule.id, p)}
            onRunNow={() => runNow(schedule.id)}
            onSkip={(t) => toggleSkip(schedule.id, t)}
          />
        ) : (
          <div className="ui-ags-panel ui-ags-panel--empty">
            <EmptyState bare title={labels.noSchedule} text={labels.noScheduleText} />
          </div>
        ),
      },
    ],
    defaultTabs: ["schedule"],
    newTab: false,
  });
  const open = (id: string) => {
    setSelected(id);
    ws.show("schedule");
    onSelect?.(id);
  };

  const rows = () => [...(listRef.current?.querySelectorAll<HTMLElement>(".ui-ags-row__main") ?? [])];
  const step = (dir: number) => {
    const l = rows();
    if (!l.length) return;
    const i = l.indexOf(document.activeElement as HTMLElement);
    (i < 0 ? (l.find((r) => r.dataset.id === selected) ?? l[0]) : l[Math.min(l.length - 1, Math.max(0, i + dir))])?.focus();
  };
  const onKey = (e: globalThis.KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const t = document.activeElement;
    if (t && t !== document.body && !root.current?.contains(t)) return;
    if (isTyping(t)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "j" || k === "k") {
      e.preventDefault();
      step(k === "j" ? 1 : -1);
    }
  };
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      step(e.key === "ArrowDown" ? 1 : -1);
    }
  };

  const active = items.filter((s) => !s.paused).length;

  return (
    <AppShell
      active="Schedules"
      nav={nav}
      groups={groups}
      workspace={workspace}
      workspaceMeta="Pro · Personal"
      sideCards={false}
      workArea={ws}
      panelTitle="Schedule"
      panelWidth={{ default: 380, min: 300, max: 520 }}
      onNavigate={onNavigate}
      {...props}
    >
      <style href="ui-screen-agent-schedules" precedence="default">
        {css}
      </style>
      <div ref={root} className="ui-ags">
        <header className="ui-ags-head">
          <h1 className="ui-ags-title">{labels.schedules}</h1>
          {!loading && (
            <span className="ui-ags-num ui-ags-faint">
              {active} / {items.length}
            </span>
          )}
        </header>
        <div className="ui-ags-scroll">
          <div className="ui-ags-page">
            {loading ? (
              <SchedulesSkeleton labels={labels} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Calendar03Icon}
                title={labels.empty}
                text={labels.emptyText}
                action={
                  <button type="button" className="ui-ags-btn" onClick={() => onNavigate?.("Thread")}>
                    <Icon icon={Message01Icon} size={14} />
                    {labels.emptyAction}
                  </button>
                }
              />
            ) : (
              <>
                <Timeline schedules={items} now={now} skipped={skipped} skipKey={skipKey} labels={labels} onOpen={open} />
                <section className="ui-ags-section" aria-labelledby="ui-ags-list-h">
                  <h2 id="ui-ags-list-h" className="ui-ags-label">
                    {labels.schedules}
                  </h2>
                  <ul ref={listRef} className="ui-ags-rows" onKeyDown={onListKey}>
                    {sorted.map((s) => (
                      <ScheduleRow key={s.id} schedule={s} next={nextOf(s)} now={now} labels={labels} selected={s.id === selected} onOpen={() => open(s.id)} onPause={(p) => setPaused(s.id, p)} />
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>
        <p className="ui-ags-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </AppShell>
  );
}

/* ---------- Loading: gray bars in the real card and rows ---------- */

/** Widths for the skeletons – fixed, so every load looks the same */
const SKEL_NAMES = [124, 96, 140, 112, 104, 120, 132];
const SKEL_CADENCE = [132, 176, 148, 160, 120, 104, 188];
const SKEL_NEXT = [112, 128, 104, 120, 136, 116, 100];

/** One gray bar, centered in a line of the real text's height – 8px for 12px meta, 10px for 13px text */
function SkelLine({ h, w, small, className }: { h?: number; w: number | string; small?: boolean; className?: string }) {
  return (
    <span className={className ? `ui-ags-skel-line ${className}` : "ui-ags-skel-line"} style={h ? { height: h } : undefined}>
      <Skeleton width={w} height={small ? 8 : 10} />
    </span>
  );
}

/** The chart and the list while they load: the same card and 42px rows, gray where the data goes */
function SchedulesSkeleton({ labels }: { labels: Labels }) {
  return (
    <>
      <section className="ui-ags-section" aria-labelledby="ui-ags-now-h">
        <h2 id="ui-ags-now-h" className="ui-ags-label">
          {labels.aroundNow}
        </h2>
        <Loading label={labels.aroundNow} className="ui-ags-card ui-ags-line">
          <div className="ui-ags-line__top ui-ags-skel-top">
            <span>{labels.activity}</span>
            <SkelLine className="ui-ags-skel-lh" w={88} small />
          </div>
          <div className="ui-ags-chart ui-ags-skel-chart" data-skel="">
            <Skeleton width="100%" height="100%" />
          </div>
          <SkelLine h={20} w={220} />
        </Loading>
      </section>
      <section className="ui-ags-section" aria-labelledby="ui-ags-list-h">
        <h2 id="ui-ags-list-h" className="ui-ags-label">
          {labels.schedules}
        </h2>
        <Loading label={labels.schedules} className="ui-ags-rows">
          {SKEL_NAMES.map((w, i) => (
            <div key={i} className="ui-ags-row" data-skel="">
              <div className="ui-ags-row__main">
                <Skeleton width={8} height={8} radius={2} />
                <span className="ui-ags-row__text ui-ags-skel-text">
                  <SkelLine h={20} w={w} />
                  <SkelLine className="ui-ags-skel-cadence" w={SKEL_CADENCE[i]} />
                  <span className="ui-ags-row__nextline">
                    <SkelLine h={16} w={SKEL_NEXT[i]} small />
                  </span>
                </span>
                <span className="ui-ags-row__next ui-ags-skel-end">
                  <SkelLine h={20} w={SKEL_NEXT[i]} />
                </span>
                <span className="ui-ags-row__last">
                  <Skeleton width={40} height={18} radius={4} />
                </span>
                <span className="ui-ags-row__cost">
                  <SkelLine className="ui-ags-skel-end" h={20} w={32} small />
                </span>
              </div>
              <Skeleton width={30} height={18} radius={9} />
            </div>
          ))}
        </Loading>
      </section>
    </>
  );
}

/** The Schedule panel while it loads: a gray title and buttons, the brief, the next runs and the last ones */
function SchedulePanelSkeleton({ labels }: { labels: Labels }) {
  return (
    <Loading label={labels.schedules} className="ui-ags-panel">
      <div className="ui-ags-panel__head" data-skel="">
        <Skeleton className="ui-ags-skel-mark" width={8} height={8} radius={2} />
        <span className="ui-ags-panel__titles">
          <span className="ui-ags-skel-line" style={{ height: 22 }}>
            <Skeleton width={136} height={12} />
          </span>
          <SkelLine h={16} w={184} small />
        </span>
      </div>
      <div className="ui-ags-panel__acts" data-skel="">
        <Skeleton width={92} height={28} radius={6} />
        <Skeleton width={72} height={28} radius={6} />
      </div>
      <section className="ui-ags-section" data-skel="">
        <h3 className="ui-ags-label">{labels.what}</h3>
        <span className="ui-ags-skel-prompt">
          <SkelLine h={20} w="96%" />
          <SkelLine h={20} w="72%" />
        </span>
      </section>
      <section className="ui-ags-section" data-skel="">
        <h3 className="ui-ags-label">{labels.nextRuns}</h3>
        <div className="ui-ags-card ui-ags-list">
          {[120, 104].map((w, i) => (
            <div key={i} className="ui-ags-skel-run">
              <Skeleton width={w} height={10} />
              <Skeleton width={56} height={8} />
            </div>
          ))}
        </div>
      </section>
      <section className="ui-ags-section" data-skel="">
        <h3 className="ui-ags-label">{labels.lastRuns}</h3>
        <div className="ui-ags-card ui-ags-history">
          {[188, 120, 168].map((w, i) => (
            <div key={i} className="ui-ags-skel-run ui-ags-skel-run--last">
              <span className="ui-ags-history__text">
                <SkelLine h={20} w={w} />
                <SkelLine h={16} w={[112, 96, 104][i]} small />
              </span>
              <Skeleton width={40} height={18} radius={4} />
            </div>
          ))}
        </div>
      </section>
    </Loading>
  );
}

/* ---------- Timeline ---------- */

const BEHIND = 4 * HOUR;
const AHEAD = 8 * HOUR;
const BUCKET = 10 * MIN;

/** How busy the agent is at a time, in actions per 10 minutes – a calm hum, and a hill for every run it made */
const activityAt = (t: number, schedules: Schedule[]) => {
  const k = t / BUCKET;
  let v = 1.3 + 0.45 * Math.sin(k * 0.7) + 0.25 * Math.sin(k * 1.9 + 1) + 0.12 * Math.sin(k * 4.3 + 2);
  for (const s of schedules)
    for (const r of s.runs) {
      const span = Math.max(s.duration ?? 0, 25 * MIN);
      if (t >= r && t <= r + span) v += (3 + Math.min(6, (s.cost ?? 0.3) * 1.6)) * Math.sin((Math.PI * (t - r)) / span);
    }
  return Math.max(0.2, v);
};
/** A smooth line through the points – Catmull-Rom as cubic Béziers */
const smooth = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => {
      if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
      const [x0, y0] = pts[Math.max(0, i - 2)];
      const [x1, y1] = pts[i - 1];
      const [x3, y3] = pts[Math.min(pts.length - 1, i + 1)];
      const c1x = x1 + (x - x0) / 6;
      const c1y = y1 + (y - y0) / 6;
      const c2x = x - (x3 - x1) / 6;
      const c2y = y - (y3 - y1) / 6;
      return `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");

/**
 * The hours around now as a live chart of how busy the agent is: a line with a soft fill up to now, its head a glowing
 * point; every run a marker in its project's color (red when it failed), the coming ones dashed. When a run starts the
 * line climbs at the head and a chip says what's running. Under it, what's running or what's next, in words
 */
export function Timeline({
  schedules,
  now,
  skipped,
  skipKey,
  labels,
  onOpen,
}: {
  schedules: Schedule[];
  now: number;
  skipped: string[];
  skipKey: (id: string, t: number) => string;
  labels: Labels;
  onOpen: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 136;
  // Markers stand a little lower than the chart – their caps sit just above the highest the line goes
  const capY = 32;
  const base = H - 22;
  const gridTop = 10;
  const from = now - BEHIND;
  const to = now + AHEAD;
  const x = (t: number) => ((t - from) / (to - from)) * w;

  const marks = schedules
    .flatMap((s) =>
      s.runs
        .filter((t) => t >= from && t <= to && !skipped.includes(skipKey(s.id, t)) && !(s.paused && t > now))
        .map((t) => {
          const d = s.duration ?? 0;
          const state = t > now ? "next" : now - t < d ? "running" : "ran";
          const failed = s.history?.some((h) => Math.abs(h.at - t) < MIN && h.outcome === "failed");
          return { s, t, state, failed, progress: state === "running" ? (now - t) / d : state === "ran" ? 1 : 0 };
        }),
    )
    .sort((a, b) => a.t - b.t);
  const running = marks.filter((m) => m.state === "running");
  const next = marks.find((m) => m.state === "next");

  // The line: ten-minute steps up to now, then the head – which climbs while a run goes
  const steps: number[] = [];
  // A narrow chart takes every other step, so the line stays calm
  const step = w < 520 ? BUCKET * 2 : BUCKET;
  for (let t = Math.ceil(from / step) * step; t < now; t += step) steps.push(t);
  const lift = running.reduce((v, m) => v + 5 * Math.min(1, (now - m.t) / 1500) * (1 - Math.max(0, (m.progress - 0.85) / 0.15)), 0);
  const values = [...steps.map((t) => activityAt(t, schedules)), activityAt(now, schedules) + lift];
  const max = Math.max(8, ...values) * 1.15;
  const y = (v: number) => base - (v / max) * (base - capY - 6);
  // Quiet horizontal lines behind it all
  // Three of them – the top one would cut off the run markers, which end where the chart does
  const grid = [0.25, 0.5, 0.75].map((f) => base - f * (base - gridTop));
  const pts: [number, number][] = [...steps, now].map((t, i) => [x(t), y(values[i])]);
  const line = smooth(pts);
  const head = pts[pts.length - 1];
  const area = `${line}L${head[0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z`;
  const rate = Math.round(values[values.length - 1]);

  const ticks: number[] = [];
  const every = w < 420 ? 4 : 2;
  const first = new Date(from);
  first.setMinutes(0, 0, 0);
  for (let t = first.getTime() + HOUR; t < to; t += HOUR) if (new Date(t).getHours() % every === 0) ticks.push(t);
  // The chip sits right of the head – left only when there's no room right and more room left; it never leaves the chart
  const chipFlip = head[0] + 190 > w && head[0] > w / 2;
  const chipRoom = Math.max(80, Math.min(220, chipFlip ? head[0] - 14 : w - head[0] - 14));

  return (
    <section className="ui-ags-section" aria-labelledby="ui-ags-now-h">
      <h2 id="ui-ags-now-h" className="ui-ags-label">
        {labels.aroundNow}
      </h2>
      <div className="ui-ags-card ui-ags-line">
        <div className="ui-ags-line__top">
          <span>{labels.activity}</span>
          <span className="ui-ags-num">
            <b>{rate}</b> {rate === 1 ? labels.perTenOne : labels.perTen}
          </span>
        </div>
        <div ref={box} className="ui-ags-chart">
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
            <defs>
              <linearGradient id="ui-ags-fade" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--ags-blue)" stopOpacity="0.14" />
                <stop offset="1" stopColor="var(--ags-blue)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {grid.map((gy) => (
              <line key={gy} className="ui-ags-chart__grid" x1="0" x2={w} y1={gy} y2={gy} />
            ))}
            <line className="ui-ags-chart__base" x1="0" x2={w} y1={base} y2={base} />
            {marks.map((m) => (
              <g key={`${m.s.id}@${m.t}`} className="ui-ags-marker" data-state={m.state} data-failed={m.failed || undefined} style={{ ["--ags-tone" as string]: toneOf(m.s.tone) }}>
                <line x1={x(m.t)} x2={x(m.t)} y1={capY} y2={base} />
                {m.state === "next" ? <circle cx={x(m.t)} cy={capY} r="3" /> : <rect x={x(m.t) - 2.5} y={capY - 2.5} width="5" height="5" rx="1" />}
              </g>
            ))}
            <path className="ui-ags-chart__area" d={area} />
            <path className="ui-ags-chart__line" d={line} />
            <circle className="ui-ags-chart__glow" cx={head[0]} cy={head[1]} r="9" />
            <circle className="ui-ags-chart__head" cx={head[0]} cy={head[1]} r="3.5" />
            {ticks.map((t) => (
              <text key={t} className="ui-ags-tick" x={x(t)} y={H - 4} textAnchor="middle">
                {clock.format(t)}
              </text>
            ))}
          </svg>
          {/* Each marker is a button – the schedule it belongs to opens */}
          {marks.map((m) => (
            <button
              key={`b${m.s.id}@${m.t}`}
              type="button"
              className="ui-ags-mark"
              style={{ left: x(m.t), top: capY }}
              aria-label={`${m.s.name}, ${clock.format(m.t)}, ${m.state === "running" ? `${labels.runningNow}, ${Math.round(m.progress * 100)}%` : m.state === "ran" ? (m.failed ? labels.failed : labels.done) : relText(m.t, now)}`}
              title={`${m.s.name} · ${clock.format(m.t)}`}
              onClick={() => onOpen(m.s.id)}
            />
          ))}
          {running.length > 0 && (
            <span className="ui-ags-chip" data-flip={chipFlip || undefined} style={{ left: head[0], top: Math.max(4, head[1] - 46), maxWidth: chipRoom }} aria-hidden="true">
              <span className="ui-ags-live" />
              <span className="ui-ags-chip__name">{running[0].s.name}</span>
              <span className="ui-ags-num ui-ags-faint">{Math.round(running[0].progress * 100)}%</span>
            </span>
          )}
        </div>
        <p className="ui-ags-line__say" role="status">
          {running.length ? (
            <>
              <span className="ui-ags-live" aria-hidden="true" />
              <b>{labels.runningNow}:</b>
              <span className="ui-ags-line__name">{running.map((m) => m.s.name).join(", ")}</span>
              <span className="ui-ags-num ui-ags-faint">· {Math.round(running[0].progress * 100)}%</span>
            </>
          ) : next ? (
            <>
              <b>{labels.next}:</b>
              <span className="ui-ags-line__name">{next.s.name}</span>
              <span className="ui-ags-num ui-ags-faint">
                · {clock.format(next.t)}, {relText(next.t, now)}
              </span>
            </>
          ) : (
            <span className="ui-ags-faint">{labels.nothingNext}</span>
          )}
        </p>
      </div>
    </section>
  );
}

/* ---------- Rows ---------- */

/** A schedule: its mark, name and rhythm, when it runs next, how the last run ended, what a run costs – and its switch */
function ScheduleRow({
  schedule: s,
  next,
  now,
  labels,
  selected,
  onOpen,
  onPause,
}: {
  schedule: Schedule;
  next?: number;
  now: number;
  labels: Labels;
  selected: boolean;
  onOpen: () => void;
  onPause: (paused: boolean) => void;
}) {
  const last = s.history?.[0];
  const outcome = last ? (last.outcome === "done" ? labels.done : last.outcome === "needs" ? labels.needs : labels.failed) : null;
  return (
    <li className="ui-ags-row" data-selected={selected || undefined} data-paused={s.paused || undefined} style={{ ["--ags-tone" as string]: toneOf(s.tone) }}>
      <button
        type="button"
        className="ui-ags-row__main"
        data-id={s.id}
        aria-current={selected || undefined}
        aria-label={`${s.name}, ${s.cadence}, ${s.paused ? labels.paused : next ? `next ${whenText(next, now)}` : ""}${outcome ? `, last run ${outcome}` : ""}`}
        onClick={onOpen}
      >
        <span className="ui-ags-row__mark" aria-hidden="true" />
        <span className="ui-ags-row__text">
          <span className="ui-ags-row__name" dir="auto" title={s.name}>
            {s.name}
          </span>
          <span className="ui-ags-row__cadence" dir="auto" title={s.cadence}>
            {s.cadence}
          </span>
          {/* On a phone the next run moves under the rhythm */}
          <span className="ui-ags-row__nextline ui-ags-num" aria-hidden="true">
            {s.paused ? labels.paused : next ? `${whenText(next, now)} · ${relText(next, now)}` : ""}
          </span>
        </span>
        <span className="ui-ags-row__next ui-ags-num">
          {s.paused ? (
            <span className="ui-ags-faint">{labels.paused}</span>
          ) : next ? (
            <>
              <span>{whenText(next, now)}</span>
              <span className="ui-ags-faint ui-ags-row__rel">{relText(next, now)}</span>
            </>
          ) : null}
        </span>
        <span className="ui-ags-row__last">{outcome && <span className="ui-ags-badge" data-outcome={last!.outcome}>{outcome}</span>}</span>
        <span className="ui-ags-row__cost ui-ags-num" title={s.cost != null ? money.format(s.cost) : undefined}>
          {s.cost == null ? "" : s.cost >= 1000 ? moneyShort.format(s.cost) : money.format(s.cost)}
        </span>
      </button>
      <Switch on={!s.paused} label={`${s.name}: ${s.paused ? labels.resume : labels.pause}`} onChange={(on) => onPause(!on)} />
    </li>
  );
}

/** On / off – a role="switch": blue and to the right while it runs on its schedule */
export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="ui-ags-switch" onClick={() => onChange(!on)}>
      <span className="ui-ags-switch__knob" aria-hidden="true" />
    </button>
  );
}

/* ---------- Panel ---------- */

/** A schedule: what it does, its rhythm, Run now and Pause; its next runs, each one skippable; how its last ones went */
function SchedulePanel({
  schedule: s,
  now,
  skipped,
  skipKey,
  labels,
  onPause,
  onRunNow,
  onSkip,
}: {
  schedule: Schedule;
  now: number;
  skipped: string[];
  skipKey: (id: string, t: number) => string;
  labels: Labels;
  onPause: (paused: boolean) => void;
  onRunNow: () => void;
  onSkip: (t: number) => void;
}) {
  const coming = s.runs.filter((t) => t > now).sort((a, b) => a - b).slice(0, 5);
  const history = (s.history ?? []).slice(0, 5);
  const running = s.runs.some((t) => t <= now && now - t < (s.duration ?? 0));
  return (
    <div className="ui-ags-panel" style={{ ["--ags-tone" as string]: toneOf(s.tone) }} aria-label={s.name}>
      <div className="ui-ags-panel__head">
        <span className="ui-ags-row__mark" aria-hidden="true" />
        <span className="ui-ags-panel__titles">
          <h2 className="ui-ags-panel__title" dir="auto">
            {s.name}
          </h2>
          <span className="ui-ags-panel__sub" dir="auto">
            <Icon icon={RepeatIcon} size={12} />
            {s.cadence}
            {s.project ? ` · ${s.project}` : ""}
          </span>
        </span>
      </div>

      <div className="ui-ags-panel__acts">
        <button type="button" className="ui-ags-btn ui-ags-btn--dark" disabled={running} onClick={onRunNow}>
          <Icon icon={PlayIcon} size={14} />
          <span>{running ? labels.runningNow : labels.runNow}</span>
        </button>
        <button type="button" className="ui-ags-btn" onClick={() => onPause(!s.paused)}>
          <Icon icon={s.paused ? PlayIcon : PauseIcon} size={14} />
          <span>{s.paused ? labels.resume : labels.pause}</span>
        </button>
        {s.cost != null && (
          <span className="ui-ags-faint ui-ags-num ui-ags-panel__cost">
            {money.format(s.cost)} {labels.perRun}
          </span>
        )}
      </div>

      {s.prompt && (
        <section className="ui-ags-section" aria-label={labels.what}>
          <h3 className="ui-ags-label">{labels.what}</h3>
          <Prompt text={s.prompt} labels={labels} />
        </section>
      )}

      <section className="ui-ags-section" aria-label={labels.nextRuns}>
        <h3 className="ui-ags-label">{labels.nextRuns}</h3>
        {s.paused ? (
          <p className="ui-ags-note">{labels.paused}</p>
        ) : coming.length ? (
          <ul className="ui-ags-card ui-ags-list">
            {coming.map((t) => {
              const off = skipped.includes(skipKey(s.id, t));
              return (
                <li key={t} data-skipped={off || undefined}>
                  <span className="ui-ags-list__when ui-ags-num">{whenText(t, now)}</span>
                  <span className="ui-ags-faint ui-ags-num">{off ? labels.skipped : relText(t, now)}</span>
                  <button type="button" className="ui-ags-link" aria-label={`${off ? labels.restore : labels.skip}: ${whenText(t, now)}`} onClick={() => onSkip(t)}>
                    {off ? (
                      <>
                        <Icon icon={ArrowTurnBackwardIcon} size={12} />
                        {labels.restore}
                      </>
                    ) : (
                      labels.skip
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ui-ags-note">{labels.noRuns}</p>
        )}
      </section>

      <section className="ui-ags-section" aria-label={labels.lastRuns}>
        <h3 className="ui-ags-label">{labels.lastRuns}</h3>
        {history.length ? (
          <ul className="ui-ags-card ui-ags-history">
            {history.map((h) => (
              <li key={h.at}>
                <span className="ui-ags-history__text">
                  <span className="ui-ags-history__summary" dir="auto" title={h.summary}>
                    {h.summary}
                  </span>
                  <span className="ui-ags-faint ui-ags-num">
                    {whenText(h.at, now)}
                    {h.cost != null ? ` · ${money.format(h.cost)}` : ""}
                  </span>
                </span>
                <span className="ui-ags-badge" data-outcome={h.outcome}>
                  {h.outcome === "done" ? labels.done : h.outcome === "needs" ? labels.needs : labels.failed}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ui-ags-note">{labels.noRuns}</p>
        )}
      </section>
    </div>
  );
}

/** The brief it runs with – six lines, and Show all when there's more */
function Prompt({ text, labels }: { text: string; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLQuoteElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 1);
  }, [text]);
  return (
    <div className="ui-ags-prompt-wrap">
      <blockquote ref={ref} className="ui-ags-prompt" data-open={open || undefined} dir="auto">
        {text}
      </blockquote>
      {(long || open) && (
        <button type="button" className="ui-ags-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? labels.less : labels.more}
        </button>
      )}
    </div>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-ags, .ui-ags-panel {
  --ui-ags-focus: var(--aui-focus, rgba(0, 96, 226, 0.7));
  --ags-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ags-card-shadow: var(--aui-shadow-card, 0 0 0 0.5px var(--aui-border, rgba(0, 0, 0, 0.06)), 0 1px 1px -1px rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  --ags-line: var(--aui-border, rgba(0, 0, 0, 0.06));
  --ags-blue: var(--aui-blue, #0190fe);
  --ags-c-purple: var(--aui-purple, #a651f0);
  --ags-c-orange: var(--aui-orange, #f28a2e);
  --ags-c-teal: var(--aui-teal, #13b3a0);
  --ags-c-blue: var(--aui-blue, #0190fe);
  --ags-c-amber: var(--aui-amber, #e8b000);
  --ags-c-pink: var(--aui-pink, #ee3e9e);
  --ags-c-green: var(--aui-green, #5fc88a);
  --ags-c-gray: rgba(0, 0, 0, 0.3);
}
:where(.dark, [data-theme="dark"]) :is(.ui-ags, .ui-ags-panel) {
  --ui-ags-focus: var(--aui-focus, rgba(77, 141, 255, 0.8));
  --ags-card-shadow: var(--aui-shadow-card, 0 0 0 0.5px var(--aui-border, rgba(255, 255, 255, 0.08)), 0 1px 2px 0 rgba(0, 0, 0, 0.3));
  --ags-line: var(--aui-border, rgba(255, 255, 255, 0.07));
  --ags-blue: var(--aui-blue, #4fb0fe);
  --ags-c-purple: var(--aui-purple, #b98af0);
  --ags-c-orange: var(--aui-orange, #f2a15c);
  --ags-c-teal: var(--aui-teal, #4fc3b4);
  --ags-c-blue: var(--aui-blue, #4fb0fe);
  --ags-c-amber: var(--aui-amber, #e6c24d);
  --ags-c-pink: var(--aui-pink, #f06db5);
  --ags-c-green: var(--aui-green, #7dcf9f);
  --ags-c-gray: rgba(255, 255, 255, 0.32);
}
.ui-ags { position: relative; container: ui-ags / inline-size; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; background: var(--panel); }
.ui-ags-num { font-variant-numeric: tabular-nums; }
.ui-ags-faint { color: var(--faint); }
.ui-ags-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:is(.ui-ags, .ui-ags-panel) :focus-visible { outline: 2px solid var(--ui-ags-focus); outline-offset: 2px; }

.ui-ags-head { display: flex; flex: none; align-items: center; gap: 10px; height: var(--as-head-h, 48px); padding: 0 12px 0 20px; box-shadow: inset 0 -0.5px 0 var(--line); font-size: 13px; }
.ui-ags-title { margin: 0; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); }
.ui-ags-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.ui-ags-page { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; max-width: 760px; margin: 0 auto; padding: 24px 24px 48px; }
.ui-ags-section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.ui-ags-label { margin: 0; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--muted); }
.ui-ags-card { margin: 0; padding: 0; list-style: none; border-radius: var(--aui-radius-lg, 10px); background: var(--card); box-shadow: var(--ags-card-shadow); }
.ui-ags-page > .ui-as-empty { margin-top: 0; }

/* ---------- Timeline: a live chart of how busy it is ---------- */
.ui-ags-line { display: grid; gap: 10px; padding: 14px 16px 14px; }
.ui-ags-line__top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--muted); }
.ui-ags-line__top b { font-weight: 500; color: var(--ink); }
.ui-ags-chart { position: relative; contain: inline-size; }
.ui-ags-chart svg { display: block; overflow: visible; }
.ui-ags-chart__grid { stroke: var(--ags-line); stroke-width: 1; opacity: 0.4; }
.ui-ags-chart__base { stroke: var(--ags-line); stroke-width: 1; }
.ui-ags-chart__area { fill: url(#ui-ags-fade); }
.ui-ags-chart__line { fill: none; stroke: var(--ags-blue); stroke-width: 1.75; stroke-linejoin: round; stroke-linecap: round; }
.ui-ags-chart__head { fill: var(--ags-blue); stroke: var(--card); stroke-width: 1.5; }
.ui-ags-chart__glow { fill: var(--ags-blue); opacity: 0.18; transform-box: fill-box; transform-origin: center; animation: ui-ags-glow 2200ms ease-in-out infinite; }
.ui-ags-tick { font: 400 11px var(--font-sans, inherit); fill: var(--faint); }
/* Runs: a line in the project's color with a square cap – red when it failed; coming ones dashed with a hollow cap */
.ui-ags-marker line { stroke: var(--ags-tone); stroke-width: 1; opacity: 0.55; }
.ui-ags-marker rect { fill: var(--ags-tone); }
.ui-ags-marker[data-failed] line { stroke: var(--aui-red, #f04438); opacity: 0.8; }
.ui-ags-marker[data-failed] rect { fill: var(--aui-red, #f04438); }
.ui-ags-marker[data-state="next"] line { stroke-dasharray: 2 3; opacity: 0.45; }
.ui-ags-marker[data-state="next"] circle { fill: var(--card); stroke: var(--ags-tone); stroke-width: 1.5; }
.ui-ags-marker[data-state="running"] line { opacity: 0.9; }
.ui-ags-mark { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: calc(var(--aui-radius-sm, 5px) + 1px); }
.ui-ags-mark:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.ui-ags-mark:focus-visible { outline-offset: -2px; }
/* What's running, beside the head */
.ui-ags-chip { position: absolute; display: inline-flex; align-items: center; gap: 6px; max-width: 220px; padding: 3px 9px 3px 8px; border-radius: calc(var(--aui-radius-sm, 5px) + 2px); background: var(--card); box-shadow: 0 0 0 0.5px var(--ags-line), 0 6px 16px -6px rgba(0, 0, 0, 0.2); font-size: 12px; line-height: 18px; color: var(--ink); white-space: nowrap; transform: translateX(10px); animation: ui-ags-chip 320ms var(--ags-out) both; pointer-events: none; }
.ui-ags-chip[data-flip] { transform: translateX(calc(-100% - 10px)); }
.ui-ags-chip__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.ui-ags-line__say { display: flex; align-items: center; gap: 6px; min-width: 0; margin: 0; font-size: 13px; line-height: 20px; color: var(--text); white-space: nowrap; }
.ui-ags-line__say b { font-weight: 500; color: var(--ink); }
.ui-ags-line__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ui-ags-live { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--ags-blue); animation: ui-ags-blink 1200ms ease-in-out infinite; }

/* ---------- Rows ---------- */
/* The schedules sit right on the page – just the rows, with hairlines between them */
.ui-ags-rows { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; margin: 0 -10px; padding: 0; list-style: none; }
.ui-ags-row { display: flex; align-items: center; gap: 8px; padding-right: 10px; border-radius: calc(var(--aui-radius-sm, 5px) + 5px); transition: background-color 140ms ease; }
.ui-ags-row:hover { background: var(--hover); }
.ui-ags-row[data-selected] { background: color-mix(in srgb, var(--ink) 4%, var(--card)); }
.ui-ags-row__main { display: flex; flex: 1; align-items: center; gap: 12px; min-width: 0; min-height: 42px; padding: 0 0 0 12px; border-radius: calc(var(--aui-radius-sm, 5px) + 5px); text-align: left; }
.ui-ags-row__main:focus-visible { outline-offset: -2px; }
.ui-ags-row__mark { flex: none; width: 8px; height: 8px; border-radius: 2px; background: var(--ags-tone); }
.ui-ags-row[data-paused] .ui-ags-row__mark { background: none; box-shadow: inset 0 0 0 1.5px var(--ags-tone); }
.ui-ags-row__text { display: flex; flex: 1; align-items: baseline; gap: 10px; min-width: 0; }
.ui-ags-row__name { flex: 0 1 auto; min-width: 0; overflow: hidden; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-ags-row[data-paused] .ui-ags-row__name { color: var(--text); }
.ui-ags-row__cadence { flex: 0 100 auto; min-width: 0; overflow: hidden; font-size: 13px; line-height: 20px; color: var(--muted); white-space: nowrap; text-overflow: ellipsis; }
.ui-ags-row__nextline { display: none; font-size: 12px; line-height: 16px; color: var(--ink); }
.ui-ags-row__next { display: flex; flex: none; align-items: baseline; justify-content: flex-end; gap: 6px; width: 190px; font-size: 13px; line-height: 20px; color: var(--ink); white-space: nowrap; }
.ui-ags-row__rel { font-size: 12px; }
.ui-ags-row__last { display: flex; flex: none; justify-content: flex-end; width: 78px; }
.ui-ags-row__cost { flex: none; width: 60px; white-space: nowrap; font-size: 12px; color: var(--muted); text-align: right; }
.ui-ags-badge { flex: none; padding: 0 6px; border-radius: calc(var(--aui-radius-sm, 5px) - 1px); background: var(--chip); font-size: 11px; font-weight: 500; line-height: 18px; color: var(--muted); white-space: nowrap; }
.ui-ags-badge[data-outcome="needs"] { background: #ff9c0024; color: var(--aui-warning, #b25e00); }
.ui-ags-badge[data-outcome="failed"] { background: color-mix(in srgb, var(--aui-red, #f04438) 13%, var(--card)); color: var(--aui-danger, #c4320a); }
:where(.dark, [data-theme="dark"]) .ui-ags-badge[data-outcome="needs"] { color: var(--aui-warning, #ffb35c); }
:where(.dark, [data-theme="dark"]) .ui-ags-badge[data-outcome="failed"] { color: var(--aui-danger, #ff8a7a); }

.ui-ags-switch { position: relative; flex: none; width: 30px; height: 18px; border-radius: 9px; background: color-mix(in srgb, var(--ink) 16%, var(--card)); transition: background-color 200ms ease; }
.ui-ags-switch[aria-checked="true"] { background: var(--ags-blue); }
.ui-ags-switch__knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: transform 240ms var(--ags-out); }
.ui-ags-switch[aria-checked="true"] .ui-ags-switch__knob { transform: translateX(12px); }

.ui-ags-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; height: 28px; padding: 0 10px 0 8px; border-radius: calc(var(--aui-radius, 7px) - 1px); background: var(--card); box-shadow: var(--ags-card-shadow); font-size: 13px; font-weight: 500; color: var(--ink); white-space: nowrap; transition: box-shadow 140ms ease, filter 140ms ease, opacity 140ms ease; }
.ui-ags-btn:hover { box-shadow: 0 0 0 0.5px var(--aui-border-strong, rgba(0, 0, 0, 0.1)), 0 2px 4px rgba(0, 0, 0, 0.06); }
.ui-ags-btn > svg { flex: none; color: var(--muted); }
.ui-ags-btn--dark { background: var(--aui-primary, var(--ink)); box-shadow: none; color: var(--aui-on-primary, var(--card)); }
.ui-ags-btn--dark > svg { color: inherit; }
.ui-ags-btn--dark:hover { box-shadow: none; filter: brightness(1.15); }
.ui-ags-btn:disabled { opacity: 0.55; cursor: default; filter: none; }
.ui-ags-btn:active:not(:disabled) { transform: scale(0.97); }

/* ---------- Panel ---------- */
.ui-ags-panel { display: flex; flex-direction: column; gap: 22px; padding: 4px 4px 16px; }
.ui-ags-panel--empty { display: grid; min-height: 240px; place-items: center; }
.ui-ags-panel :focus-visible { outline-offset: -2px; }
.ui-ags-panel__head { display: flex; align-items: flex-start; gap: 10px; }
.ui-ags-panel__head .ui-ags-row__mark { margin-top: 7px; }
.ui-ags-panel__titles { display: grid; gap: 2px; min-width: 0; }
.ui-ags-panel__title { margin: 0; font-size: 15px; font-weight: 500; line-height: 22px; color: var(--ink); overflow-wrap: anywhere; }
.ui-ags-panel__sub { display: flex; align-items: center; gap: 5px; min-width: 0; font-size: 12px; line-height: 16px; color: var(--muted); }
.ui-ags-panel__sub > svg { flex: none; }
.ui-ags-panel__acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: -8px; }
.ui-ags-panel__cost { margin-left: auto; font-size: 12px; }
.ui-ags-prompt-wrap { display: grid; justify-items: start; gap: 4px; }
.ui-ags-prompt-wrap .ui-ags-link { margin-left: 2px; }
.ui-ags-prompt:not([data-open]) { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 6; -webkit-box-orient: vertical; }
.ui-ags-prompt { margin: 0; padding-left: 10px; box-shadow: inset 2px 0 0 var(--ags-line); font-size: 13px; line-height: 20px; color: var(--text); overflow-wrap: anywhere; }
.ui-ags-panel .ui-ags-card { margin: 0 -8px; }
.ui-ags-list { padding: 2px 12px; }
.ui-ags-list li { display: flex; align-items: center; gap: 10px; min-height: 40px; font-size: 13px; }
.ui-ags-list li + li { box-shadow: inset 0 0.5px 0 var(--ags-line); }
.ui-ags-list__when { color: var(--ink); }
.ui-ags-list li[data-skipped] .ui-ags-list__when { color: var(--faint); text-decoration: line-through; }
.ui-ags-list li > .ui-ags-faint { flex: 1; font-size: 12px; }
.ui-ags-link { display: inline-flex; flex: none; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border-radius: calc(var(--aui-radius-sm, 5px) + 1px); font-size: 12px; color: var(--muted); transition: background-color 140ms ease, color 140ms ease; }
.ui-ags-link:hover { background: var(--chip); color: var(--ink); }
.ui-ags-history { padding: 2px 12px; }
.ui-ags-history li { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.ui-ags-history li + li { box-shadow: inset 0 0.5px 0 var(--ags-line); }
.ui-ags-history__text { display: grid; flex: 1; min-width: 0; font-size: 12px; line-height: 16px; }
.ui-ags-history__summary { overflow: hidden; font-size: 13px; line-height: 20px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-ags-note { margin: 0; font-size: 13px; color: var(--faint); }

.ui-as-app[data-panel="closed"] .ui-ags-head { padding-right: 52px; }
@container ui-as (max-width: 900px) {
  .ui-ags-head { padding-left: 46px; padding-right: 52px; }
}
@container ui-ags (max-width: 640px) {
  .ui-ags-page { padding: 16px 16px 40px; gap: 24px; }
  .ui-ags-row__cost, .ui-ags-row__last, .ui-ags-row__rel { display: none; }
  .ui-ags-row__next { width: auto; }
}
/* Phones: the name over its rhythm and the next run – two lines, the fill grows with them */
@container ui-ags (max-width: 440px) {
  .ui-ags-row__main { min-height: 56px; padding: 8px 0 8px 12px; }
  .ui-ags-row__main > .ui-ags-row__mark { align-self: flex-start; margin-top: 6px; }
  .ui-ags-row__text { flex-direction: column; align-items: stretch; gap: 0; }
  .ui-ags-row__cadence, .ui-ags-row__nextline { font-size: 12px; line-height: 16px; }
  .ui-ags-row__next { display: none; }
  .ui-ags-row__nextline { display: block; }
}

/* Loading: the same card, rows and line heights – gray bars in place of the text */
:is(.ui-ags, .ui-ags-panel) [data-skel] { pointer-events: none; }
.ui-ags-skel-line { display: flex; align-items: center; min-width: 0; }
.ui-ags-skel-cadence { flex: 0 100 auto; height: 20px; }
.ui-ags-row__text.ui-ags-skel-text { align-items: center; }
.ui-ags-skel-end { justify-content: flex-end; }
.ui-ags-skel-top { align-items: center; }
.ui-ags-skel-lh { height: 1lh; }
.ui-ags-skel-mark { margin-top: 7px; }
.ui-ags-skel-chart { height: 136px; padding: 10px 0 22px; }
.ui-ags-skel-prompt { display: grid; padding-left: 10px; box-shadow: inset 2px 0 0 var(--ags-line); }
.ui-ags-skel-run { display: flex; align-items: center; gap: 10px; min-height: 40px; }
.ui-ags-skel-run--last { min-height: 0; padding: 8px 0; }
.ui-ags-skel-run + .ui-ags-skel-run { box-shadow: inset 0 0.5px 0 var(--ags-line); }
@container ui-ags (max-width: 440px) {
  .ui-ags-row__text.ui-ags-skel-text { align-items: stretch; }
  .ui-ags-skel-cadence { height: 16px; }
  .ui-ags-skel-cadence > * { height: 8px !important; }
}

@keyframes ui-ags-glow { 0%, 100% { transform: scale(0.7); opacity: 0.25; } 50% { transform: scale(1.25); opacity: 0.08; } }
@keyframes ui-ags-chip { from { opacity: 0; } }
@keyframes ui-ags-blink { 50% { opacity: 0.35; } }

@media (prefers-reduced-motion: reduce) {
  .ui-ags-chart__glow, .ui-ags-live, .ui-ags-chip { animation: none; }
}
@media (pointer: coarse) {
  .ui-ags-btn, .ui-ags-link { min-height: 36px; }
  .ui-ags-switch { width: 40px; height: 24px; border-radius: 12px; }
  .ui-ags-switch__knob { width: 20px; height: 20px; }
  .ui-ags-switch[aria-checked="true"] .ui-ags-switch__knob { transform: translateX(16px); }
}
`;
