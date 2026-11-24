// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * Run Detail – one agent run, step by step, in a single file.
 * On top: the run – the agent's pixel mark, what it was asked, its status as a tag – and four numbers that keep
 * counting while it runs: time, cost, tokens and steps. Rerun or Stop on the right.
 * Below – across the full width: every step as a row on one time axis – thinking in violet, tool calls in cyan with the app's logo, sub-agents
 * in gray with their own mark, failures in red. Bars grow in from the left; a running bar carries a sheen and a
 * glowing leading edge, and a blue line marks now. Each bar says how long it took.
 * A step opens on the right, in the App Shell's work area: what it was, when it started and how long it took, its tokens
 * and cost, then what went in and what came out – or the error.
 * Keyboard: J / K or ↑ / ↓ move from step to step, Enter opens it on the right.
 * Sits in the affectUI App Shell; icons from the Hugeicons free set.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import {
  AiBrain02Icon,
  AiMagicIcon,
  Analytics01Icon,
  Brain02Icon,
  Calendar03Icon,
  CheckListIcon,
  Copy01Icon,
  Database01Icon,
  InboxIcon,
  Message01Icon,
  RepeatIcon,
  Settings01Icon,
  Shield01Icon,
  StopIcon,
  Task01Icon,
  UserMultiple02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { AppShell, EmptyState, Icon, Loading, Skeleton, useToast, useWorkArea, type AppShellProps, type ShellGroup, type ShellNavItem } from "@/components/app-shell";

/* ---------- Types ---------- */

export type StepKind = "llm" | "tool" | "agent";
export type RunStep = {
  id: string;
  label: string;
  kind: StepKind;
  /** Seconds from the start of the run */
  start: number;
  /** Seconds it took – leave it out while it runs */
  duration?: number;
  /** One level in for steps a sub-agent took */
  depth?: number;
  /** The app a tool call went to, e.g. "GitHub" – its logo shows before the step */
  app?: string;
  /** For a sub-agent: its id and color – its pixel mark shows before the step */
  agent?: { id: string; color: string };
  failed?: boolean;
  error?: string;
  tokens?: { in: number; out: number };
  /** In euros */
  cost?: number;
  input?: string;
  output?: string;
};
export type AgentRun = {
  id: string;
  title: string;
  agent: { id: string; name: string; color: string };
  model: string;
  /** When it started */
  startedAt: number;
  steps: RunStep[];
  /** Seconds the whole run took – leave it out while it runs */
  total?: number;
};

/* ---------- Sample content – replace with your own data ---------- */

const nav: ShellNavItem[] = [
  { label: "Thread", icon: Message01Icon },
  { label: "Inbox", icon: InboxIcon, count: 2 },
  { label: "Agents", icon: UserMultiple02Icon },
  { label: "Tasks", icon: CheckListIcon },
  { label: "Memory", icon: Brain02Icon },
  { label: "Skills", icon: AiMagicIcon },
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

export const sampleRun = (startedAt = Date.now()): AgentRun => ({
  id: "run_8f2c",
  title: "Migrate users table",
  agent: { id: "builder", name: "Builder", color: "#0190fe" },
  model: "Opus 5.5",
  startedAt,
  total: 59.6,
  steps: [
    {
      id: "plan",
      label: "Plan the migration",
      kind: "llm",
      start: 0,
      duration: 3.2,
      tokens: { in: 4210, out: 612 },
      cost: 0.09,
      input: "Split the users table into accounts and profiles on Postgres 17. Nothing may be lost, and the app has to keep working during the move.",
      output: "1. Read the schema and the last migrations\n2. Write migration 0042_split_users\n3. Open a pull request and let Reviewer check it\n4. Dry run on staging, post the result",
    },
    { id: "schema", label: "Read the schema", kind: "tool", app: "GitHub", start: 3.2, duration: 1.4, cost: 0, input: "GET db/schema.sql", output: "users: 31 columns · 48,210 rows · 6 indexes" },
    { id: "migrations", label: "Read 14 migrations", kind: "tool", app: "GitHub", start: 4.6, duration: 3.2, cost: 0, input: "GET db/migrations/0028…0041", output: "14 files · last one added users.timezone (0041)" },
    {
      id: "write",
      label: "Write migration 0042",
      kind: "llm",
      start: 7.8,
      duration: 6.3,
      tokens: { in: 18_640, out: 2_104 },
      cost: 0.41,
      input: "Write 0042_split_users with an up and a down step. Copy in batches of 5,000 and keep a view named users for old reads.",
      output: "CREATE TABLE accounts (…);\nCREATE TABLE profiles (…);\nINSERT INTO accounts SELECT … LIMIT 5000;\nCREATE VIEW users AS SELECT … ;",
    },
    { id: "pr", label: "Open pull request #491", kind: "tool", app: "GitHub", start: 14.1, duration: 0.9, cost: 0, input: "POST /pulls · base main · head builder/split-users", output: "#491 opened · 3 files changed" },
    { id: "review", label: "Reviewer checks the diff", kind: "agent", agent: { id: "reviewer", color: "#a651f0" }, start: 15, duration: 7.4, tokens: { in: 9_820, out: 940 }, cost: 0.12, input: "Review #491 – bugs and data loss first.", output: "Approved with one note: add an index on profiles.account_id." },
    { id: "tests", label: "Run the test suite", kind: "tool", app: "GitHub", depth: 1, start: 15.6, duration: 5.2, cost: 0, input: "Actions · ci.yml", output: "214 passed · 0 failed" },
    { id: "comment", label: "Write the review", kind: "llm", depth: 1, start: 20.8, duration: 1.6, tokens: { in: 3_400, out: 380 }, cost: 0.03, input: "Summarise the review for #491.", output: "Looks good. Add an index on profiles.account_id before this runs on production." },
    { id: "dry1", label: "Dry run on staging", kind: "tool", app: "Postgres", start: 22.4, duration: 1.6, failed: true, error: "Lock timeout – another job held users for 30s", input: "BEGIN; RUN 0042 ON staging; ROLLBACK;", output: "" },
    { id: "dry2", label: "Dry run on staging · retry", kind: "tool", app: "Postgres", start: 24, duration: 9.6, cost: 0, input: "BEGIN; RUN 0042 ON staging; ROLLBACK;", output: "48,210 rows copied · 0 lost · 9.4s · rolled back" },
    { id: "index", label: "Add the missing index", kind: "llm", start: 33.6, duration: 2.5, tokens: { in: 6_120, out: 410 }, cost: 0.11, input: "Reviewer asked for an index on profiles.account_id – add it to 0042.", output: "CREATE INDEX profiles_account_id_idx ON profiles (account_id);" },
    { id: "update", label: "Update pull request #491", kind: "tool", app: "GitHub", start: 36.1, duration: 0.9, cost: 0, input: "PUSH builder/split-users · 1 file", output: "#491 updated · 4 files changed" },
    { id: "retest", label: "Run the test suite again", kind: "tool", app: "GitHub", start: 37, duration: 5.4, cost: 0, input: "Actions · ci.yml", output: "216 passed · 0 failed" },
    { id: "guard", label: "Guard checks the data rules", kind: "agent", agent: { id: "guard", color: "#13b3a0" }, start: 37.4, duration: 7.4, tokens: { in: 7_310, out: 520 }, cost: 0.08, input: "Check 0042 for personal data leaving the database and for access rules that change.", output: "No personal data leaves the database · access rules unchanged" },
    { id: "pii", label: "Scan the logs for personal data", kind: "tool", app: "Postgres", depth: 1, start: 37.8, duration: 3.4, cost: 0, input: "SELECT … FROM pg_stat_statements WHERE query ILIKE '%email%'", output: "0 matches" },
    { id: "rules", label: "Check the access rules", kind: "llm", depth: 1, start: 41.2, duration: 3.2, tokens: { in: 2_940, out: 260 }, cost: 0.02, input: "Compare the grants before and after 0042.", output: "The view users keeps the same grants – nothing changes for the app." },
    { id: "dry3", label: "Dry run on staging · final", kind: "tool", app: "Postgres", start: 44.8, duration: 8.4, cost: 0, input: "BEGIN; RUN 0042 ON staging; ROLLBACK;", output: "48,210 rows copied · 0 lost · 8.2s · index built · rolled back" },
    { id: "count", label: "Compare row counts", kind: "tool", app: "Postgres", start: 53.2, duration: 1.4, cost: 0, input: "SELECT count(*) FROM users_before, accounts, profiles", output: "48,210 = 48,210 = 48,210" },
    { id: "summary", label: "Write the summary", kind: "llm", start: 54.6, duration: 3.3, tokens: { in: 8_450, out: 690 }, cost: 0.14, input: "Summarise the run for Alex: what changed, what was checked, what's left.", output: "0042 is ready. Dry run on staging copied all 48,210 rows in 8.2s with nothing lost; tests pass; Guard found no issues. It needs your approval to run on production." },
    { id: "post", label: "Post the result", kind: "tool", app: "Slack", start: 57.9, duration: 0.9, cost: 0, input: "#platform · the summary", output: "Posted to #platform" },
    { id: "ask", label: "Ask Alex to approve", kind: "tool", app: "Slack", start: 58.8, duration: 0.8, cost: 0, input: "DM @alex · approve the production run?", output: "Sent · waiting in Alex's Inbox" },
  ],
});

/* ---------- Helpers ---------- */

const KIND: Record<StepKind, string> = { llm: "Thinking", tool: "Tool call", agent: "Sub-agent" };
const number0 = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const euro2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n: number) => String(n).padStart(2, "0");
/** A duration: 0.4s, 12s, 3m 05s, 2h 04m */
const secs = (s: number) => {
  if (s < 0.1 && s > 0) return "<0.1s";
  if (s < 10) return `${s.toFixed(1)}s`;
  const r = Math.round(s);
  if (r < 60) return `${r}s`;
  if (r < 3600) return `${Math.floor(r / 60)}m ${pad2(r % 60)}s`;
  return `${Math.floor(r / 3600)}h ${pad2(Math.floor((r % 3600) / 60))}m`;
};
/** An axis label: 0s, 10s … 1m, 1m 10s */
const tickText = (t: number) =>
  t < 60 ? `${+t.toFixed(1)}s` : t < 3600 ? (t % 60 ? `${Math.floor(t / 60)}m ${Math.round(t % 60)}s` : `${t / 60}m`) : t % 3600 ? `${Math.floor(t / 3600)}h ${Math.round((t % 3600) / 60)}m` : `${t / 3600}h`;
const clockAt = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const isTyping = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);
/** A round step for the axis in clock units – seconds, minutes or hours – about six ticks across */
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
const tickStep = (range: number) => STEPS.find((x) => x >= range / 6) ?? Math.ceil(range / 6 / 86400) * 86400;

/* ---------- Marks and logos ---------- */

/** Twinkle order – a diagonal wave */
const WAVE = [0, 120, 240, 120, 240, 360, 240, 360, 480];
/** An agent's own 3×3 pattern, mirrored left to right, from its id – never fewer than five squares */
const pattern = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let k = 0; k < 64; k++) {
    const bits = (h >> (k % 26)) & 63;
    const cells = [0, 1, 2].flatMap((r) => {
      const a = (bits >> (r * 2)) & 1;
      const b = (bits >> (r * 2 + 1)) & 1;
      return [a, b, a];
    });
    if (cells.filter(Boolean).length >= 5) return cells;
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return [1, 0, 1, 0, 1, 0, 1, 0, 1];
};
/** The agent's pixel mark in its color – it twinkles while the agent works */
function AgentMark({ id, color, busy }: { id: string; color?: string; busy?: boolean }) {
  return (
    <span className="ui-ard-mark" data-busy={busy || undefined} style={color ? ({ "--ard-mark": color } as CSSProperties) : undefined} aria-hidden="true">
      {pattern(id).map((on, i) => (
        <i key={i} data-on={on ? "" : undefined} style={{ animationDelay: `${WAVE[i]}ms` }} />
      ))}
    </span>
  );
}

const LOGOS: Record<string, () => ReactElement> = {
  GitHub: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  Slack: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E01E5A" d="M5.04 15.17a2.53 2.53 0 0 1-2.52 2.52A2.53 2.53 0 0 1 0 15.17a2.53 2.53 0 0 1 2.52-2.53h2.52zm1.27 0a2.53 2.53 0 0 1 2.53-2.53 2.53 2.53 0 0 1 2.52 2.53v6.31A2.53 2.53 0 0 1 8.84 24a2.53 2.53 0 0 1-2.53-2.52z" />
      <path fill="#36C5F0" d="M8.84 5.04a2.53 2.53 0 0 1-2.53-2.52A2.53 2.53 0 0 1 8.84 0a2.53 2.53 0 0 1 2.52 2.52v2.52zm0 1.27a2.53 2.53 0 0 1 2.52 2.53 2.53 2.53 0 0 1-2.52 2.52H2.52A2.53 2.53 0 0 1 0 8.84a2.53 2.53 0 0 1 2.52-2.53z" />
      <path fill="#2EB67D" d="M18.96 8.84a2.53 2.53 0 0 1 2.52-2.53A2.53 2.53 0 0 1 24 8.84a2.53 2.53 0 0 1-2.52 2.52h-2.52zm-1.27 0a2.53 2.53 0 0 1-2.53 2.52 2.53 2.53 0 0 1-2.52-2.52V2.52A2.53 2.53 0 0 1 15.16 0a2.53 2.53 0 0 1 2.53 2.52z" />
      <path fill="#ECB22E" d="M15.16 18.96a2.53 2.53 0 0 1 2.53 2.52A2.53 2.53 0 0 1 15.16 24a2.53 2.53 0 0 1-2.52-2.52v-2.52zm0-1.27a2.53 2.53 0 0 1-2.52-2.53 2.53 2.53 0 0 1 2.52-2.52h6.32A2.53 2.53 0 0 1 24 15.16a2.53 2.53 0 0 1-2.52 2.53z" />
    </svg>
  ),
  Postgres: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#336791" />
      <path fill="#fff" d="M7.2 6.5h5.1c2.3 0 3.9 1.4 3.9 3.5s-1.6 3.6-3.9 3.6H9.6v3.9H7.2zm2.4 2.1v2.9h2.5c1 0 1.7-.6 1.7-1.5s-.7-1.4-1.7-1.4z" />
    </svg>
  ),
};

/** What a step is: the app's logo for a tool call, the sub-agent's mark, a brain for thinking */
function StepMark({ step: s, running }: { step: RunStep; running: boolean }) {
  if (s.kind === "agent" && s.agent) return <span className="ui-ard-tile"><AgentMark id={s.agent.id} color={s.agent.color} busy={running} /></span>;
  const L = s.app ? LOGOS[s.app] : undefined;
  return (
    <span className="ui-ard-tile" data-kind={s.kind}>
      {L ? <L /> : <Icon icon={s.kind === "llm" ? AiBrain02Icon : s.app ? Database01Icon : Wrench01Icon} size={12} />}
    </span>
  );
}

/* ---------- Screen ---------- */

export type AgentRunDetailScreenProps = Pick<AppShellProps, "onNavigate" | "user" | "className"> & {
  workspace?: string;
  run?: AgentRun;
  /** Seconds since the run started – pass it while the run is live; without it the run is shown as finished */
  elapsed?: number;
  /** The step open on the right when the screen starts */
  defaultOpen?: string | null;
  onRerun?: () => void;
  onStop?: () => void;
  loading?: boolean;
  /** A run without any steps yet */
  empty?: boolean;
};

export function AgentRunDetailScreen({
  workspace = "Fieldwork",
  run: runProp,
  elapsed,
  defaultOpen = "write",
  onRerun,
  onStop,
  loading,
  empty: emptyProp,
  onNavigate,
  ...props
}: AgentRunDetailScreenProps) {
  const [sample] = useState(() => sampleRun());
  const run = runProp ?? sample;
  const empty = !!emptyProp && !loading;
  const [opened, setOpened] = useState<string | null>(defaultOpen);
  const [toast, showToast] = useToast();
  const root = useRef<HTMLDivElement>(null);

  // What the run looks like at this moment: steps that have begun, the ones still going cut at now
  const live = elapsed !== undefined && (run.total === undefined || elapsed < run.total);
  const now = live ? elapsed! : (run.total ?? Math.max(0, ...run.steps.map((s) => s.start + (s.duration ?? 0))));
  const steps = empty ? [] : run.steps.filter((s) => s.start <= now);
  const isRunning = (s: RunStep) => live && (s.duration === undefined || s.start + s.duration > now);
  const lengthOf = (s: RunStep) => (isRunning(s) ? Math.max(0.05, now - s.start) : (s.duration ?? Math.max(0.05, now - s.start)));
  const done = steps.filter((s) => !isRunning(s));
  const cost = done.reduce((a, s) => a + (s.cost ?? 0), 0);
  const tokens = done.reduce((a, s) => a + (s.tokens ? s.tokens.in + s.tokens.out : 0), 0);
  const failed = steps.filter((s) => s.failed).length;
  // The axis runs to a round number a little past the end, so the last bar and its time fit
  const span = Math.max(1, run.total ?? 0, now);
  const step = tickStep(span);
  const range = Math.ceil((span * 1.08) / step) * step;
  const ticks = Array.from({ length: Math.floor(range / step) + 1 }, (_, i) => +(i * step).toFixed(2));
  const status = loading ? undefined : live ? "running" : steps[steps.length - 1]?.failed ? "failed" : "done";

  const step0 = loading ? undefined : steps.find((s) => s.id === opened);
  const ws = useWorkArea({
    tabs: [
      {
        id: "step",
        title: loading ? "Loading" : step0 ? step0.label : "Step",
        icon: Task01Icon,
        content: loading ? (
          <PanelSkeleton />
        ) : step0 ? (
          <StepPanel key={step0.id} step={step0} running={isRunning(step0)} length={lengthOf(step0)} onCopy={(t) => (navigator.clipboard?.writeText(t).catch(() => {}), showToast("Copied"))} />
        ) : (
          <div className="ui-ard-panel ui-ard-panel--empty">
            <EmptyState bare title="Nothing open" text="Pick a step to see what went in, what came out and what it cost." />
          </div>
        ),
      },
    ],
    defaultTabs: ["step"],
    newTab: false,
  });
  const show = (id: string) => {
    setOpened(id);
    ws.show("step");
  };

  /* ----- Keyboard: J / K walk the steps, Enter opens ----- */
  const targets = () => [...(root.current?.querySelectorAll<HTMLElement>("[data-step]") ?? [])];
  const move = (dir: number) => {
    const l = targets();
    if (!l.length) return;
    const i = l.indexOf(document.activeElement as HTMLElement);
    (i < 0 ? l[0] : l[Math.min(l.length - 1, Math.max(0, i + dir))])?.focus();
  };
  const keyRef = useRef<(e: globalThis.KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const t = document.activeElement;
    if ((t && t !== document.body && !root.current?.contains(t)) || isTyping(t) || document.querySelector(".ui-as-popover")) return;
    const k = e.key.toLowerCase();
    if (k === "j" || k === "k") {
      e.preventDefault();
      move(k === "j" ? 1 : -1);
    }
  };
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const onListKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    move(e.key === "ArrowDown" ? 1 : -1);
  };

  const pct = (v: number) => `${(v / range) * 100}%`;

  return (
    <AppShell
      active="Agents"
      nav={nav}
      groups={groups}
      workspace={workspace}
      workspaceMeta="Pro · Personal"
      sideCards={false}
      workArea={ws}
      panelTitle="Step"
      panelWidth={{ default: 360, min: 300, max: 520 }}
      onNavigate={onNavigate}
      {...props}
    >
      <style href="ui-screen-agent-run-detail" precedence="default">
        {css}
      </style>
      <div ref={root} className="ui-ard">
        <div className="ui-ard__scroll">
          <div className="ui-ard__in">
            {/* The run: who, what, how it stands – and what you can do */}
            <header className="ui-ard-head">
              {loading ? (
                <Loading label="Loading the run" className="ui-ard-head__who">
                  <Skeleton width={22} height={22} radius={6} />
                  <span className="ui-ard-head__titles">
                    <span className="ui-ard-skel">
                      <Skeleton width={180} height={11} />
                    </span>
                    <span className="ui-ard-skel ui-ard-skel--sm">
                      <Skeleton width={140} height={8} />
                    </span>
                  </span>
                </Loading>
              ) : (
                <span className="ui-ard-head__who">
                  <span className="ui-ard-tile ui-ard-tile--agent">
                    <AgentMark id={run.agent.id} color={run.agent.color} busy={live} />
                  </span>
                  <span className="ui-ard-head__titles">
                    <span className="ui-ard-head__title-row">
                      <h1 className="ui-ard-head__title" dir="auto" title={run.title}>
                        {run.title}
                      </h1>
                    </span>
                    <span className="ui-ard-head__sub" dir="auto">
                      {run.agent.name} · {run.model} · started {clockAt(run.startedAt)}
                    </span>
                  </span>
                </span>
              )}
              <span className="ui-ard-head__acts">
                {status && (
                  <span className="ui-ard-status" data-status={status}>
                    {status === "running" ? "Running" : status === "failed" ? "Failed" : "Done"}
                  </span>
                )}
                {live ? (
                  <button type="button" className="ui-ard-btn" onClick={() => (onStop?.(), showToast("Stopping the run"))}>
                    <Icon icon={StopIcon} size={14} />
                    Stop
                  </button>
                ) : (
                  <button type="button" className="ui-ard-btn" disabled={loading} onClick={() => (onRerun?.(), showToast("Run started again"))}>
                    <Icon icon={RepeatIcon} size={14} />
                    Rerun
                  </button>
                )}
              </span>
            </header>

            {/* Four numbers that keep counting while it runs */}
            <dl className="ui-ard-stats">
              {[
                ["Time", loading ? null : secs(now)],
                ["Cost", loading ? null : euro2.format(cost)],
                ["Tokens", loading ? null : compact.format(tokens)],
                ["Steps", loading ? null : `${steps.length}${failed ? ` · ${failed} failed` : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="ui-ard-stat" data-failed={k === "Steps" && failed ? "" : undefined}>
                  <dt>{k}</dt>
                  <dd className="ui-ard-num">{v ?? <Skeleton width={56} height={12} />}</dd>
                </div>
              ))}
            </dl>

            {/* The steps on one time axis */}
            <section className="ui-ard-trace" aria-label="Steps">
              <div className="ui-ard-trace__top">
                <span className="ui-ard-legend" aria-hidden="true">
                  <span data-kind="llm">Thinking</span>
                  <span data-kind="tool">Tool call</span>
                  <span data-kind="agent">Sub-agent</span>
                  <span data-kind="error">Failed</span>
                </span>
              </div>
              <div className="ui-ard-grid">
                <div className="ui-ard-axis" aria-hidden="true">
                  <span />
                  <span className="ui-ard-axis__track">
                    {ticks.map((t, i) => (
                      <span key={t} className="ui-ard-axis__tick ui-ard-num" data-odd={i % 2 === 1 || undefined} style={{ left: pct(t) }} data-first={t === 0 || undefined} data-last={t === ticks[ticks.length - 1] || undefined}>
                        {tickText(t)}
                      </span>
                    ))}
                  </span>
                </div>
                {loading ? (
                  <Loading label="Loading the steps" className="ui-ard-rows">
                    {[[0, 18], [10, 8], [22, 14], [40, 30], [74, 6], [82, 12]].map(([l, w], i) => (
                      <div key={i} className="ui-ard-row" data-skel="">
                        <span className="ui-ard-row__label">
                          <Skeleton width={18} height={18} radius={5} />
                          <Skeleton width={[120, 90, 110, 140, 80, 100][i]} height={9} />
                        </span>
                        <span className="ui-ard-row__track">
                          <span className="ui-ard-skelbar" style={{ left: `${l}%`, width: `${w}%` }} />
                        </span>
                      </div>
                    ))}
                  </Loading>
                ) : steps.length === 0 ? (
                  <div className="ui-ard-none">
                    <EmptyState bare icon={Task01Icon} title="No steps yet" text="The agent hasn't started – its steps show up here as it works." />
                  </div>
                ) : (
                  <ul className="ui-ard-rows" onKeyDown={onListKey}>
                    {/* Behind the bars: the tick lines and, while it runs, now */}
                    <li className="ui-ard-lines" aria-hidden="true">
                      <span />
                      <span className="ui-ard-lines__track">
                        {ticks.map((t) => (
                          <i key={t} style={{ left: pct(t) }} />
                        ))}
                        {live && <b className="ui-ard-now" style={{ left: pct(now) }} />}
                      </span>
                    </li>
                    {steps.map((s) => {
                      const running = isRunning(s);
                      const len = lengthOf(s);
                      const end = s.start + len;
                      const side = end / range > 0.84 ? "before" : "after";
                      return (
                        <li key={s.id} className="ui-ard-row ui-ard-row--step" data-open={opened === s.id || undefined} data-depth={s.depth || undefined}>
                          <button
                            type="button"
                            className="ui-ard-row__main"
                            data-step={s.id}
                            aria-current={opened === s.id || undefined}
                            aria-label={`${s.label} – ${KIND[s.kind]}${s.app ? `, ${s.app}` : ""}, ${running ? "running" : s.failed ? "failed" : secs(len)}`}
                            onClick={() => show(s.id)}
                          >
                            <span className="ui-ard-row__label">
                              <StepMark step={s} running={running} />
                              <span className="ui-ard-row__name" dir="auto" title={s.label}>
                                {s.label}
                              </span>
                            </span>
                            <span className="ui-ard-row__track">
                              <span className="ui-ard-bar" data-kind={s.failed ? "error" : s.kind} data-running={running || undefined} style={{ left: pct(s.start), width: `max(3px, ${pct(len)})` }} />
                              <span className="ui-ard-tag ui-ard-num" data-side={side} data-kind={s.failed ? "error" : s.kind} style={side === "after" ? { left: `calc(${pct(end)} + 4px)` } : { right: `calc(${100 - (s.start / range) * 100}% + 4px)` }}>
                                {s.failed ? "failed" : secs(len)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
        <span className="ui-ard-sr" aria-live="polite">
          {loading ? "" : live ? `Running · ${steps.length} steps so far` : `Done in ${secs(now)} · ${steps.length} steps`}
        </span>
      </div>
      {toast}
    </AppShell>
  );
}

/* ---------- Panel ---------- */

/** A step on the right: what it was, its timing, tokens and cost, what went in and what came out – or the error */
function StepPanel({ step: s, running, length, onCopy }: { step: RunStep; running: boolean; length: number; onCopy: (text: string) => void }) {
  return (
    <div className="ui-ard-panel" aria-label={s.label}>
      <div className="ui-ard-panel__head">
        <StepMark step={s} running={running} />
        <span className="ui-ard-panel__titles">
          <h2 className="ui-ard-panel__name" dir="auto" title={s.label}>
            {s.label}
          </h2>
          <span className="ui-ard-panel__sub">
            {KIND[s.kind]}
            {s.app ? ` · ${s.app}` : ""}
          </span>
        </span>
        <span className="ui-ard-status" data-status={running ? "running" : s.failed ? "failed" : "done"}>
          {running ? "Running" : s.failed ? "Failed" : "Done"}
        </span>
      </div>

      <dl className="ui-ard-props">
        <dt>Started</dt>
        <dd className="ui-ard-num">+{secs(s.start)}</dd>
        <dt>Took</dt>
        <dd className="ui-ard-num">{running ? `${secs(length)} so far` : secs(length)}</dd>
        {s.tokens && (
          <>
            <dt>Tokens</dt>
            <dd className="ui-ard-num">
              {number0.format(s.tokens.in)} in · {number0.format(s.tokens.out)} out
            </dd>
          </>
        )}
        {s.cost !== undefined && (
          <>
            <dt>Cost</dt>
            <dd className="ui-ard-num">{euro2.format(s.cost)}</dd>
          </>
        )}
      </dl>

      {s.failed && s.error && (
        <section className="ui-ard-panel__section" aria-label="Error">
          <h3 className="ui-ard-panel__label">Error</h3>
          <p className="ui-ard-error" dir="auto">
            {s.error}
          </p>
        </section>
      )}
      {s.input && <Block label="Input" text={s.input} onCopy={onCopy} />}
      {running ? (
        <section className="ui-ard-panel__section" aria-label="Output">
          <h3 className="ui-ard-panel__label">Output</h3>
          <p className="ui-ard-waiting">
            <AgentMark id="writing" busy />
            Still working…
          </p>
        </section>
      ) : (
        s.output && <Block label="Output" text={s.output} onCopy={onCopy} />
      )}
    </div>
  );
}

/** Input or output in a gray well, in the code font, with Copy */
function Block({ label, text, onCopy }: { label: string; text: string; onCopy: (text: string) => void }) {
  return (
    <section className="ui-ard-panel__section" aria-label={label}>
      <h3 className="ui-ard-panel__label ui-ard-panel__label--split">
        {label}
        <button type="button" className="ui-ard-link" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => onCopy(text)}>
          <Icon icon={Copy01Icon} size={12} />
          Copy
        </button>
      </h3>
      <pre className="ui-ard-code" dir="auto">
        {text}
      </pre>
    </section>
  );
}

function PanelSkeleton() {
  return (
    <Loading label="Loading the step" className="ui-ard-panel ui-ard-panel--skel">
      <div className="ui-ard-panel__head">
        <Skeleton width={22} height={22} radius={6} />
        <span className="ui-ard-panel__titles">
          <span className="ui-ard-skel">
            <Skeleton width={120} height={10} />
          </span>
          <span className="ui-ard-skel ui-ard-skel--sm">
            <Skeleton width={80} height={8} />
          </span>
        </span>
      </div>
      <div className="ui-ard-props ui-ard-props--skel">
        {[60, 48, 120, 52].map((w, i) => (
          <span key={i} className="ui-ard-props__skel">
            <Skeleton width={48} height={9} />
            <Skeleton width={w} height={9} />
          </span>
        ))}
      </div>
      <div className="ui-ard-panel__section">
        <Skeleton width={40} height={8} />
        <Skeleton width="100%" height={72} radius={8} />
      </div>
      <div className="ui-ard-panel__section">
        <Skeleton width={48} height={8} />
        <Skeleton width="100%" height={96} radius={8} />
      </div>
    </Loading>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-ard, .ui-ard-panel {
  --ui-ard-focus: var(--aui-focus, rgba(0, 96, 226, 0.7));
  --ard-edge: rgba(0, 0, 0, 0.09);
  --ard-well: color-mix(in srgb, var(--ink) 3.5%, var(--card));
  --ard-blue: #0190fe;
  --ard-blue-ink: #0a6fc2;
  --ard-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ard-ease: cubic-bezier(0.32, 0.72, 0.24, 1);
  /* Each kind: a light tint, a hairline edge, an ink for its words and a stronger mark – as in Trace Waterfall */
  --ard-agent-bg: rgba(0, 0, 0, 0.045); --ard-agent-edge: rgba(0, 0, 0, 0.1); --ard-agent-ink: rgba(0, 0, 0, 0.61); --ard-agent-mark: rgba(0, 0, 0, 0.3);
  --ard-llm-bg: color-mix(in srgb, #a651f0 10%, transparent); --ard-llm-edge: color-mix(in srgb, #a651f0 30%, transparent); --ard-llm-ink: #8a35d6; --ard-llm-mark: color-mix(in srgb, #a651f0 72%, transparent);
  --ard-tool-bg: color-mix(in srgb, #14b3f0 8.5%, transparent); --ard-tool-edge: color-mix(in srgb, #14b3f0 28%, transparent); --ard-tool-ink: #08658c; --ard-tool-mark: color-mix(in srgb, #14b3f0 62%, transparent);
  --ard-error-bg: #f52b0018; --ard-error-edge: color-mix(in srgb, #f04438 34%, transparent); --ard-error-ink: #d72400da; --ard-error-mark: color-mix(in srgb, #f04438 62%, transparent);
}
:where(.dark, [data-theme="dark"]) :is(.ui-ard, .ui-ard-panel) {
  --ui-ard-focus: var(--aui-focus, rgba(77, 141, 255, 0.8));
  --ard-edge: rgba(255, 255, 255, 0.09);
  --ard-blue: #4fb0fe;
  --ard-blue-ink: #7cc3fe;
  --ard-agent-bg: rgba(255, 255, 255, 0.07); --ard-agent-edge: rgba(255, 255, 255, 0.14); --ard-agent-ink: rgba(255, 255, 255, 0.7); --ard-agent-mark: rgba(255, 255, 255, 0.4);
  --ard-llm-bg: color-mix(in srgb, #b98af0 16%, transparent); --ard-llm-edge: color-mix(in srgb, #b98af0 38%, transparent); --ard-llm-ink: #d1b3f5; --ard-llm-mark: color-mix(in srgb, #b98af0 80%, transparent);
  --ard-tool-bg: color-mix(in srgb, #5cc6ee 13%, transparent); --ard-tool-edge: color-mix(in srgb, #5cc6ee 34%, transparent); --ard-tool-ink: #5cc6ee; --ard-tool-mark: color-mix(in srgb, #5cc6ee 75%, transparent);
  --ard-error-bg: #ff35232b; --ard-error-edge: color-mix(in srgb, #ff6b5f 40%, transparent); --ard-error-ink: #ff8a7a; --ard-error-mark: color-mix(in srgb, #ff6b5f 75%, transparent);
}
.ui-ard { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; container: ui-ard / inline-size; }
:is(.ui-ard, .ui-ard-panel) :focus-visible { outline: 2px solid var(--ui-ard-focus); outline-offset: 2px; }
.ui-ard ul { margin: 0; padding: 0; list-style: none; }
.ui-ard-num { font-variant-numeric: tabular-nums; }
.ui-ard-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ui-ard [data-skel], .ui-ard-panel--skel { pointer-events: none; }
.ui-ard-skel { display: flex; align-items: center; height: 20px; }
.ui-ard-skel--sm { height: 16px; }

/* Kinds */
:is(.ui-ard, .ui-ard-panel) [data-kind] { --k-bg: var(--ard-agent-bg); --k-edge: var(--ard-agent-edge); --k-ink: var(--ard-agent-ink); --k-mark: var(--ard-agent-mark); }
:is(.ui-ard, .ui-ard-panel) [data-kind="llm"] { --k-bg: var(--ard-llm-bg); --k-edge: var(--ard-llm-edge); --k-ink: var(--ard-llm-ink); --k-mark: var(--ard-llm-mark); }
:is(.ui-ard, .ui-ard-panel) [data-kind="tool"] { --k-bg: var(--ard-tool-bg); --k-edge: var(--ard-tool-edge); --k-ink: var(--ard-tool-ink); --k-mark: var(--ard-tool-mark); }
:is(.ui-ard, .ui-ard-panel) [data-kind="error"] { --k-bg: var(--ard-error-bg); --k-edge: var(--ard-error-edge); --k-ink: var(--ard-error-ink); --k-mark: var(--ard-error-mark); }

/* ---------- Layout: one column, capped like the other agent screens ---------- */
.ui-ard__scroll { flex: 1; min-height: 0; overflow: auto; }
.ui-ard__in { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; box-sizing: border-box; width: 100%; margin: 0; padding: 18px 20px 40px; }

/* Head */
.ui-ard-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
.ui-ard-head__who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ui-ard-head__titles { display: grid; min-width: 0; }
.ui-ard-head__title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ui-ard-head__title { margin: 0; overflow: hidden; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-ard-head__sub { overflow: hidden; font-size: 12px; line-height: 16px; color: var(--muted); white-space: nowrap; text-overflow: ellipsis; }
.ui-ard-head__acts { display: flex; flex: none; align-items: center; gap: 10px; }
.ui-ard-tile { display: grid; flex: none; place-items: center; width: 18px; height: 18px; border-radius: 5px; background: var(--card); box-shadow: 0 0 0 0.5px var(--ard-edge), 0 1px 1.5px rgba(0, 0, 0, 0.06); color: var(--k-ink, var(--ink)); }
.ui-ard-tile > svg { width: 11px; height: 11px; }
.ui-ard-tile--agent { width: 22px; height: 22px; border-radius: 6px; }
.ui-ard-status { display: inline-flex; flex: none; align-items: center; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--chip); font-size: 11.5px; font-weight: 500; color: var(--muted); white-space: nowrap; }
.ui-ard-status[data-status="running"] { background: color-mix(in srgb, var(--ard-blue) 12%, var(--card)); color: var(--ard-blue-ink); }
.ui-ard-status[data-status="failed"] { background: var(--ard-error-bg); color: var(--ard-error-ink); }
.ui-ard-status[data-status="done"] { background: color-mix(in srgb, #1e8a4f 12%, var(--card)); color: #1e7a47; }
:where(.dark, [data-theme="dark"]) .ui-ard-status[data-status="done"] { background: color-mix(in srgb, #5fc88a 14%, var(--card)); color: #7dcf9f; }
.ui-ard-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px 0 10px; border-radius: calc(var(--aui-radius, 7px) + 1px); background: var(--card); box-shadow: var(--card-shadow); font-size: 12.5px; font-weight: 500; color: var(--ink); transition: box-shadow 140ms ease; }
.ui-ard-btn:hover:not(:disabled) { box-shadow: var(--card-shadow-hover); }
.ui-ard-btn:disabled { opacity: 0.4; }
.ui-ard-btn > svg { color: var(--muted); }

/* Stats */
/* Four cards side by side */
.ui-ard-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
.ui-ard-stat { display: grid; gap: 2px; min-width: 0; padding: 12px 14px; border-radius: 12px; background: var(--card); box-shadow: inset 0 0 0 0.5px var(--ard-edge); }
.ui-ard-stat dt { font-size: 12px; line-height: 16px; color: var(--muted); }
.ui-ard-stat dd { display: flex; align-items: center; min-height: 22px; margin: 0; overflow: hidden; font-size: 15px; font-weight: 500; line-height: 22px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-ard-stat[data-failed] dd { color: var(--ard-error-ink); }

/* ---------- Trace ---------- */
.ui-ard-trace { display: grid; gap: 10px; min-width: 0; }
.ui-ard-trace__top { display: flex; justify-content: flex-end; }
.ui-ard-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--muted); }
.ui-ard-legend > span { display: inline-flex; align-items: center; gap: 6px; }
.ui-ard-legend > span::before { content: ""; width: 10px; height: 8px; border-radius: 2px; background: var(--k-bg); box-shadow: inset 0 0 0 0.5px var(--k-mark); }
.ui-ard-grid { --ard-label: 260px; position: relative; display: grid; min-width: 0; }
.ui-ard-axis, .ui-ard-row__main, .ui-ard-lines, .ui-ard-row[data-skel] { display: grid; grid-template-columns: var(--ard-label) minmax(0, 1fr); column-gap: 12px; }
.ui-ard-axis { height: 24px; padding: 0 10px; }
.ui-ard-axis__track { position: relative; }
.ui-ard-axis__tick { position: absolute; top: 4px; font-size: 11px; color: var(--faint); transform: translateX(-50%); white-space: nowrap; }
.ui-ard-axis__tick[data-first] { transform: none; }
.ui-ard-axis__tick[data-last] { transform: translateX(-100%); }
.ui-ard-rows { position: relative; display: grid; gap: 2px; }
/* Tick lines and now – behind the rows, across them all */
.ui-ard-lines { position: absolute; inset: 0; padding: 0 10px; pointer-events: none; }
.ui-ard-lines__track { position: relative; }
.ui-ard-lines__track > i { position: absolute; top: -4px; bottom: 0; width: 0; border-left: 1px dashed color-mix(in srgb, var(--ink) 7%, transparent); }
.ui-ard-now { position: absolute; top: -2px; bottom: 0; width: 1.5px; margin-left: -0.75px; border-radius: 1px; background: var(--ard-blue); transition: left 1s linear; }
.ui-ard-now::before { content: ""; position: absolute; top: -3px; left: -2.25px; width: 6px; height: 6px; border-radius: 50%; background: var(--ard-blue); }
.ui-ard-row { position: relative; border-radius: 8px; transition: background-color 120ms ease; }
.ui-ard-row--step:hover, .ui-ard-row[data-open] { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.ui-ard-row--step { animation: ui-ard-in 320ms var(--ard-out) both; }
.ui-ard-row__main { width: 100%; height: 32px; padding: 0 10px; border-radius: inherit; text-align: left; }
.ui-ard-row[data-skel] { height: 32px; padding: 0 10px; }
.ui-ard-row__main:focus-visible { outline-offset: -2px; }
.ui-ard-row__label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ui-ard-row[data-depth] .ui-ard-row__label { padding-left: 18px; }
.ui-ard-row[data-depth] .ui-ard-row__label::before { content: ""; position: absolute; left: 19px; top: -8px; width: 8px; height: 24px; border: 0 solid var(--line-strong); border-width: 0 0 1px 1px; border-bottom-left-radius: 5px; }
.ui-ard-row__name { min-width: 0; overflow: hidden; font-size: 13px; line-height: 20px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-ard-row__track { position: relative; min-width: 0; height: 100%; }

/* A bar: a light tint with a hairline edge; it grows in from the left. While it runs, a sheen sweeps along it and its
   leading edge glows */
.ui-ard-bar { position: absolute; top: calc(50% - 7px); height: 14px; overflow: hidden; border-radius: 4px; background: var(--k-bg); box-shadow: inset 0 0 0 0.5px var(--k-edge); transition: box-shadow 160ms ease, width 1s linear; animation: ui-ard-grow 560ms var(--ard-ease) backwards; }
.ui-ard-row:is(:hover, [data-open]) .ui-ard-bar { box-shadow: inset 0 0 0 1px var(--k-mark); }
.ui-ard-bar[data-running]::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, var(--card), transparent) -60px 0 / 60px 100% no-repeat; opacity: 0.7; animation: ui-ard-sweep 1500ms linear infinite; }
.ui-ard-bar[data-running]::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: min(28px, 100%); background: linear-gradient(90deg, transparent, var(--k-edge)); animation: ui-ard-glow 1100ms ease-in-out infinite alternate; }
/* How long it took – on the card's color, so the lines pass behind it */
.ui-ard-tag { position: absolute; top: calc(50% - 9px); height: 18px; padding: 0 4px; border-radius: 4px; background: var(--card); font-size: 12px; line-height: 18px; color: var(--muted); white-space: nowrap; pointer-events: none; transition: left 1s linear; }
.ui-ard-tag[data-kind="error"] { color: var(--ard-error-ink); }
.ui-ard-row:is(:hover, [data-open]) .ui-ard-tag { background: none; }
.ui-ard-skelbar { position: absolute; top: calc(50% - 7px); height: 14px; border-radius: 4px; background: var(--chip); }
.ui-ard-none { padding: 24px 0; }

/* The agent's pixel mark */
.ui-ard-mark { --ard-mark: rgba(0, 96, 226, 0.78); display: grid; flex: none; grid-template-columns: repeat(3, 3px); grid-auto-rows: 3px; gap: 1.5px; place-content: center; width: 16px; height: 16px; }
:where(.dark, [data-theme="dark"]) .ui-ard-mark:not([style]) { --ard-mark: rgba(77, 141, 255, 0.85); }
.ui-ard-tile .ui-ard-mark { transform: scale(0.82); }
.ui-ard-tile--agent .ui-ard-mark { transform: none; }
.ui-ard-mark i { border-radius: 0.75px; background: var(--ard-mark); opacity: 0; }
.ui-ard-mark i[data-on] { opacity: 1; }
.ui-ard-mark[data-busy] i { animation: ui-ard-pixel 1.2s ease-in-out infinite both; }
.ui-ard-mark[data-busy] i:not([data-on]) { opacity: 0.16; }

/* ---------- Panel ---------- */
.ui-ard-panel { display: flex; flex-direction: column; gap: 28px; padding: 8px 8px 28px; }
.ui-ard-panel--empty { display: grid; min-height: 240px; place-items: center; }
.ui-ard-panel__head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ui-ard-panel__head > .ui-ard-tile { width: 22px; height: 22px; border-radius: 6px; }
.ui-ard-panel__titles { display: grid; flex: 1; min-width: 0; }
.ui-ard-panel__name { margin: 0; overflow: hidden; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-ard-panel__sub { overflow: hidden; font-size: 12px; line-height: 16px; color: var(--muted); white-space: nowrap; text-overflow: ellipsis; }
.ui-ard-props { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; row-gap: 4px; margin: 0; font-size: 13px; }
.ui-ard-props dt { color: var(--muted); }
.ui-ard-props dd { display: flex; align-items: center; min-height: 24px; margin: 0; color: var(--ink); }
.ui-ard-props--skel { grid-auto-rows: 24px; }
.ui-ard-props__skel { display: contents; }
.ui-ard-props__skel > * { align-self: center; }
.ui-ard-panel__section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.ui-ard-panel__label { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--muted); }
.ui-ard-panel__label--split { justify-content: space-between; }
.ui-ard-link { display: inline-flex; align-items: center; gap: 4px; height: 22px; margin: -3px -6px -3px 0; padding: 0 6px; border-radius: 6px; font-size: 12px; font-weight: 400; color: var(--muted); transition: background-color 140ms ease, color 140ms ease; }
.ui-ard-link:hover { background: var(--chip); color: var(--ink); }
.ui-ard-code { margin: 0; max-height: 240px; overflow: auto; padding: 12px 14px; border-radius: 10px; background: var(--ard-well); font: 12px/18px ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; }
.ui-ard-error { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ard-error-bg); font-size: 13px; line-height: 20px; color: var(--ard-error-ink); overflow-wrap: anywhere; }
.ui-ard-waiting { display: flex; align-items: center; gap: 8px; margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--ard-well); font-size: 13px; color: var(--muted); }

@keyframes ui-ard-grow { from { clip-path: inset(0 100% 0 0 round 4px); } to { clip-path: inset(0 0 0 0 round 4px); } }
@keyframes ui-ard-sweep { to { background-position: calc(100% + 60px) 0; } }
@keyframes ui-ard-glow { from { opacity: 0.45; } to { opacity: 1; } }
@keyframes ui-ard-in { from { opacity: 0; transform: translateY(-4px); } }
@keyframes ui-ard-pixel { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

/* With the work area folded away its button sits top right – the head keeps clear of it on wide screens */
@container ui-as (min-width: 901px) {
  .ui-as-app[data-panel="closed"] .ui-ard-head { padding-right: 40px; }
}
@container ui-ard (max-width: 640px) {
  .ui-ard-grid { --ard-label: 150px; }
  .ui-ard-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* Phones: the name over its bar */
@container ui-ard (max-width: 480px) {
  .ui-ard__in { padding: 56px 12px 32px; }
  .ui-ard-axis, .ui-ard-lines { grid-template-columns: 0 minmax(0, 1fr); column-gap: 0; }
  .ui-ard-row__main, .ui-ard-row[data-skel] { grid-template-columns: minmax(0, 1fr); height: auto; padding: 6px 10px 4px; row-gap: 2px; }
  .ui-ard-row__track { height: 20px; }
  /* Every other label, so they never run into each other */
  .ui-ard-axis__tick[data-odd] { display: none; }
  /* The name sits on the card color, so the tick lines and now pass behind it */
  .ui-ard-row__label { position: relative; z-index: 1; width: fit-content; max-width: 100%; padding-right: 6px; border-radius: 6px; background: var(--card); }
  .ui-ard-row--step:hover .ui-ard-row__label, .ui-ard-row[data-open] .ui-ard-row__label { background: color-mix(in srgb, var(--ink) 3%, var(--card)); }
  .ui-ard-row[data-depth] .ui-ard-row__label::before { display: none; }
  .ui-ard-legend { gap: 10px; }
}
@container ui-as (max-width: 900px) {
  .ui-ard__in { padding-top: 56px; }
}
@media (pointer: coarse) {
  .ui-ard-btn, .ui-ard-link { min-height: 36px; }
}
@media (prefers-reduced-motion: reduce) {
  :is(.ui-ard, .ui-ard-panel) *, :is(.ui-ard, .ui-ard-panel) *::before, :is(.ui-ard, .ui-ard-panel) *::after { animation: none !important; transition: none !important; }
}
`;
