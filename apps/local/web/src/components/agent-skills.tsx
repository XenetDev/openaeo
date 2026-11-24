// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * Skills – what your agent knows how to do, in a single file.
 * One page, no tabs: filters by what a skill is for (Writing, Research, Engineering, Data …) on top; then your skills
 * as calm cards – a small icon and the name with a switch in the corner, two quiet lines on what it does, a chip for
 * where it comes from (Built-in, Yours, @lena); then Discover – skills to add, as cards. Install turns into a ring that fills, then a
 * check, and the skill lands among yours out of a blur with a short blue glow.
 * A skill opens on the right, in the App Shell's work area: what it does, when it steps in ("Runs when you ask for …"),
 * two weeks of runs as bars, its steps, what it needs – with the way to Permissions – and where it ran lately; Turn off, Remove or Install.
 * Keyboard: J / K move from skill to skill, Enter opens, Space switches the focused one, / searches.
 * Focus rings show for the keyboard only – never on a text field.
 * Parts kept apart for reuse: SkillTile, SkillCard, Runs, InstallButton, Switch and SkillPanel.
 * Sits in the affectUI App Shell; icons from the Hugeicons free set.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Add01Icon,
  AiMagicIcon,
  Analytics01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Brain02Icon,
  Calendar03Icon,
  ChartBarLineIcon,
  CheckListIcon,
  CodeIcon,
  Delete02Icon,
  Download04Icon,
  GitPullRequestIcon,
  GlobalSearchIcon,
  InboxIcon,
  Invoice01Icon,
  LanguageSkillIcon,
  Message01Icon,
  Mic01Icon,
  News01Icon,
  Note01Icon,
  Pdf01Icon,
  Presentation01Icon,
  QuillWrite01Icon,
  Search01Icon,
  Settings01Icon,
  Shield01Icon,
  Store01Icon,
  Upload01Icon,
  Table01Icon,
  Task01Icon,
  Tick02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import {
  AppShell,
  EmptyState,
  Icon,
  rove,
  useWorkArea,
  type AppShellProps,
  type ShellGroup,
  type ShellNavItem,
} from "@/components/app-shell";

/* ---------- Types ---------- */

export type Skill = {
  id: string;
  name: string;
  /** What it does, in one line */
  description: string;
  /** What it's for – the group it shows under */
  category: string;
  icon?: IconSvgElement;
  /** A palette name (purple, orange, teal, blue, amber, pink, green) or any CSS color */
  tone?: string;
  /** builtin: comes with the agent · yours: you made it · community: someone shared it */
  source: "builtin" | "yours" | "community";
  author?: string;
  version?: string;
  installed?: boolean;
  /** Off: installed, but the agent doesn't use it */
  enabled?: boolean;
  /** How often it ran this week */
  uses?: number;
  /** How many people use it – for community skills */
  installs?: number;
  /** When it steps in – things you might say */
  triggers?: string[];
  /** What it does, step by step */
  steps?: string[];
  /** What it needs – apps and rights */
  needs?: string[];
  /** Where it ran lately */
  usedIn?: { task: string; at: number }[];
  /** Runs per day, oldest first – the last 14 days (default: drawn from uses) */
  daily?: number[];
};

/* ---------- Sample content – replace with your own data ---------- */

const minutesAgo = (m: number) => Date.now() - m * 60_000;
const H = 60;
const D = 24 * 60;

const nav: ShellNavItem[] = [
  { label: "Thread", icon: Message01Icon },
  { label: "Inbox", icon: InboxIcon, count: 5 },
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

export const sampleSkills: Skill[] = [
  {
    id: "voice",
    name: "Brand voice",
    description: "Writes in Fieldwork's tone – short, warm, no jargon",
    category: "Writing",
    icon: QuillWrite01Icon,
    tone: "pink",
    source: "yours",
    version: "1.4",
    installed: true,
    enabled: true,
    uses: 46,
    triggers: [
      "Write this in our voice",
      "Draft an email to a client",
      "Make this sound like us",
    ],
    steps: [
      "Reads the brand guide in Drive",
      "Rewrites in short sentences, active voice",
      "Swaps jargon for plain words",
      "Checks British spelling",
    ],
    needs: ["Read files in Google Drive"],
    usedIn: [
      { task: "Weekly update", at: minutesAgo(40) },
      { task: "Onboarding emails", at: minutesAgo(3 * H) },
    ],
  },
  {
    id: "weekly",
    name: "Weekly report",
    description: "Turns a week of work into a one-page update",
    category: "Writing",
    icon: News01Icon,
    tone: "orange",
    source: "builtin",
    installed: true,
    enabled: true,
    uses: 4,
    triggers: ["What happened this week?", "Draft the weekly update"],
    steps: [
      "Collects merged work and closed tasks",
      "Groups it by project",
      "Puts what needs an answer first",
    ],
    needs: ["Read GitHub", "Read Slack channels"],
    usedIn: [{ task: "Weekly update", at: minutesAgo(2 * D) }],
  },
  {
    id: "notes",
    name: "Meeting notes",
    description: "Notes and next steps from a call recording",
    category: "Writing",
    icon: Mic01Icon,
    tone: "teal",
    source: "builtin",
    installed: true,
    enabled: false,
    uses: 0,
    triggers: ["Summarise the call", "What did we agree?"],
    steps: [
      "Transcribes the recording",
      "Pulls out decisions and owners",
      "Posts the notes in the project channel",
    ],
    needs: ["Read Calendar", "Post in project channels"],
  },
  {
    id: "research",
    name: "Deep research",
    description: "Reads widely, checks sources, writes a cited brief",
    category: "Research",
    icon: GlobalSearchIcon,
    tone: "blue",
    source: "builtin",
    installed: true,
    enabled: true,
    uses: 12,
    triggers: ["Find out everything about …", "Compare these companies"],
    steps: [
      "Plans the questions",
      "Searches and reads 20–60 sources",
      "Checks every claim against two",
      "Writes a brief with citations",
    ],
    needs: ["Browse the web"],
    usedIn: [{ task: "Competitor scan", at: minutesAgo(D + 2 * H) }],
  },
  {
    id: "scan",
    name: "Competitor watch",
    description: "Spots price, product and campaign changes on rivals' sites",
    category: "Research",
    icon: Search01Icon,
    tone: "purple",
    source: "community",
    author: "lena",
    version: "2.1",
    installs: 2840,
    installed: true,
    enabled: true,
    uses: 6,
    triggers: ["What changed at our competitors?", "Check rivals' prices"],
    steps: [
      "Opens each rival's pricing and product pages",
      "Compares them with last week",
      "Lists what changed, newest first",
    ],
    needs: ["Browse the web"],
    usedIn: [{ task: "Competitor scan", at: minutesAgo(D + 2 * H) }],
  },
  {
    id: "review",
    name: "Code review",
    description: "Reviews a pull request for bugs, tests and naming",
    category: "Engineering",
    icon: GitPullRequestIcon,
    tone: "green",
    source: "builtin",
    installed: true,
    enabled: true,
    uses: 23,
    triggers: ["Review this PR", "Is this safe to merge?"],
    steps: [
      "Reads the diff and the files around it",
      "Runs the tests",
      "Comments on bugs first, style last",
    ],
    needs: ["Read code", "Open pull requests"],
    usedIn: [
      { task: "Billing webhooks", at: minutesAgo(95) },
      { task: "API migration", at: minutesAgo(2 * D) },
    ],
  },
  {
    id: "release",
    name: "Release notes",
    description: "Writes release notes people outside engineering can read",
    category: "Engineering",
    icon: CodeIcon,
    tone: "amber",
    source: "yours",
    version: "0.9",
    installed: true,
    enabled: true,
    uses: 2,
    triggers: ["Write the release notes", "What's new in this version?"],
    steps: [
      "Reads merged pull requests since the last tag",
      "Leaves out the internal ones",
      "Writes it for customers, in our voice",
    ],
    needs: ["Read code"],
    usedIn: [{ task: "API migration", at: minutesAgo(4 * D) }],
  },
  {
    id: "sheets",
    name: "Spreadsheet analysis",
    description: "Cleans a sheet, finds the trend and says it in a sentence",
    category: "Data",
    icon: Table01Icon,
    tone: "green",
    source: "builtin",
    installed: true,
    enabled: true,
    uses: 9,
    triggers: ["What does this sheet say?", "Clean up this export"],
    steps: [
      "Fixes headers, dates and duplicates",
      "Looks for the trend and the outliers",
      "Answers in one sentence, then the table",
    ],
    needs: ["Read files in Google Drive"],
    usedIn: [{ task: "Client dashboard", at: minutesAgo(5 * H) }],
  },
  {
    id: "charts",
    name: "Chart maker",
    description: "Picks the right chart for the numbers and draws it",
    category: "Data",
    icon: ChartBarLineIcon,
    tone: "blue",
    source: "community",
    author: "mika",
    version: "1.2",
    installs: 5120,
    installed: true,
    enabled: true,
    uses: 14,
    triggers: ["Make a chart of this", "Show it as a graph"],
    steps: [
      "Reads the numbers and what they compare",
      "Picks bar, line or table",
      "Draws it in the brand colors",
    ],
    usedIn: [{ task: "Client dashboard", at: minutesAgo(5 * H + 10) }],
  },
  // Discover
  {
    id: "pdf",
    name: "PDF forms",
    description: "Reads and fills in PDF forms from your documents",
    category: "Documents",
    icon: Pdf01Icon,
    tone: "orange",
    source: "community",
    author: "sam",
    installs: 8410,
    triggers: ["Fill in this form", "What does this PDF ask for?"],
    steps: [
      "Finds the fields in the PDF",
      "Fills them from your documents",
      "Asks you about anything it can't find",
    ],
    needs: ["Read files in Google Drive"],
  },
  {
    id: "translate",
    name: "Translate & localize",
    description: "Translates and adapts copy for each market",
    category: "Writing",
    icon: LanguageSkillIcon,
    tone: "teal",
    source: "builtin",
    installs: 12900,
    triggers: ["Translate this to German", "Localize the pricing page"],
    steps: [
      "Translates the meaning, not the words",
      "Adapts currency, dates and examples",
      "Keeps your brand voice",
    ],
  },
  {
    id: "deck",
    name: "Slide deck",
    description: "Turns a brief into a short, clean deck",
    category: "Documents",
    icon: Presentation01Icon,
    tone: "purple",
    source: "builtin",
    installs: 10300,
    triggers: ["Make slides for this", "Turn this into a deck"],
    steps: [
      "Outlines the story in 5–8 slides",
      "One idea per slide",
      "Charts from your data",
    ],
    needs: ["Create documents"],
  },
  {
    id: "invoices",
    name: "Invoice extraction",
    description: "Pulls amounts, dates and vendors out of invoices",
    category: "Data",
    icon: Invoice01Icon,
    tone: "amber",
    source: "community",
    author: "jo",
    installs: 3360,
    triggers: ["Read these invoices", "What did we pay in October?"],
    steps: [
      "Reads each invoice, scanned or not",
      "Pulls vendor, amount, date and tax",
      "Adds them to a sheet",
    ],
    needs: ["Read email", "Read files in Google Drive"],
  },
  {
    id: "interviews",
    name: "Interview synthesis",
    description: "Finds the patterns across customer interviews",
    category: "Research",
    icon: UserMultiple02Icon,
    tone: "pink",
    source: "community",
    author: "nora",
    installs: 1980,
    triggers: ["What did customers say?", "Find the themes in these calls"],
    steps: [
      "Reads every transcript",
      "Groups quotes by theme",
      "Ranks themes by how often they come up",
    ],
  },
  {
    id: "minutes",
    name: "Notes to tasks",
    description: "Turns any notes into tasks with owners and dates",
    category: "Writing",
    icon: Note01Icon,
    tone: "blue",
    source: "builtin",
    installs: 7600,
    triggers: ["Make tasks from these notes"],
    steps: [
      "Finds the actions in the notes",
      "Guesses owner and date, and asks when unsure",
      "Adds them to Tasks",
    ],
  },
];

/* ---------- Labels and formats ---------- */

const defaultLabels = {
  skills: "Skills",
  installed: "Installed",
  discover: "Discover",
  search: "Search skills",
  newSkill: "New skill",
  install: "Install",
  installing: "Installing",
  done: "Installed",
  remove: "Remove",
  on: "On",
  off: "Off",
  turnOn: "Turn on",
  turnOff: "Turn off",
  builtin: "Built-in",
  yours: "Yours",
  community: "Community",
  thisWeek: "this week",
  runsWhen: "Steps in when you say",
  steps: "What it does",
  needs: "What it needs",
  usedIn: "Ran lately",
  notUsed: "Not used yet",
  permissions: "Permissions",
  noSkill: "Nothing open",
  noSkillText: "Pick a skill to see what it does and when it steps in.",
  noMatch: "No skill matches",
  noMatchText: "Try other words or another category.",
  emptyInstalled: "No skills yet",
  emptyInstalledText:
    "Describe what your agent should do, write it yourself or upload a SKILL.md.",
  emptyDiscover: "You have them all",
  emptyDiscoverText: "Every skill there is is already installed.",
  clear: "Clear search",
  all: "All",
  runs: "Runs",
  twoWeeksAgo: "2 weeks ago",
  today: "Today",
  categories: "Categories",
  discoverText:
    "Skills others use – add one and your agent can do it right away",
};
export type SkillLabels = Partial<typeof defaultLabels>;
type Labels = typeof defaultLabels;
const NO_LABELS: SkillLabels = {};

const TONES: Record<string, string> = {
  purple: "var(--agk-c-purple)",
  orange: "var(--agk-c-orange)",
  teal: "var(--agk-c-teal)",
  blue: "var(--agk-c-blue)",
  amber: "var(--agk-c-amber)",
  pink: "var(--agk-c-pink)",
  green: "var(--agk-c-green)",
};
const toneOf = (t?: string) => (t ? (TONES[t] ?? t) : TONES.blue);
const number0 = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const agoLong = (at: number, now: number) => {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
};
const sourceText = (s: Skill, l: Labels) =>
  s.source === "builtin"
    ? l.builtin
    : s.source === "yours"
      ? l.yours
      : s.author
        ? `@${s.author}`
        : l.community;
const isTyping = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el as HTMLElement).isContentEditable);
/** How long an install takes in the demo – long enough to see the ring fill */
const INSTALL_MS = 1400;

/* ---------- Screen ---------- */

export type AgentSkillsScreenProps = Pick<
  AppShellProps,
  "onNavigate" | "user" | "className"
> & {
  workspace?: string;
  /** Every skill – installed and not. Pass a stable array (state): the screen follows it */
  skills?: Skill[];
  /** The skill open on the right when the screen starts */
  defaultSelected?: string | null;
  /** Called with Install – return a promise to keep the ring filling until it settles */
  onInstall?: (id: string) => void | Promise<unknown>;
  onRemove?: (id: string) => void;
  /** Called when a skill is switched on or off */
  onToggle?: (id: string, enabled: boolean) => void;
  /** Called with a skill made in New skill – described to the agent, written by hand or uploaded */
  onCreate?: (skill: Skill) => void;
  onSelect?: (id: string) => void;
  labels?: SkillLabels;
};

export function AgentSkillsScreen({
  workspace = "Fieldwork",
  skills: list = sampleSkills,
  defaultSelected = "voice",
  onInstall,
  onRemove,
  onToggle,
  onCreate,
  onSelect,
  labels: labelProp = NO_LABELS,
  onNavigate,
  ...props
}: AgentSkillsScreenProps) {
  const labels = useMemo(
    () => ({ ...defaultLabels, ...labelProp }),
    [labelProp],
  );
  const [items, setItems] = useState(list);
  useEffect(() => setItems(list), [list]);
  const [cat, setCat] = useState("all");
  const [creating, setCreating] = useState(false);
  const newBtn = useRef<HTMLButtonElement>(null);
  const discoverRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(defaultSelected);
  const [installing, setInstalling] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const announce = (text: string) => {
    setSaid("");
    window.setTimeout(() => setSaid(text), 30);
  };
  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(null), 1200);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const q = query.trim().toLowerCase();
  const matches = (s: Skill) =>
    !q ||
    `${s.name} ${s.description} ${s.category} ${s.author ?? ""}`
      .toLowerCase()
      .includes(q);
  const cats = ["all", ...new Set(items.map((s) => s.category))];
  const visible = (s: Skill) =>
    matches(s) && (cat === "all" || s.category === cat);
  // A skill being installed stays a card in Discover until its check has shown – then it lands among yours
  const mine = items.filter(
    (s) => s.installed && !installing.includes(s.id) && visible(s),
  );
  const more = items.filter(
    (s) => (!s.installed || installing.includes(s.id)) && visible(s),
  );
  const skill = items.find((s) => s.id === selected) ?? null;

  const toggle = (id: string, enabled: boolean) => {
    const s = items.find((x) => x.id === id);
    if (!s) return;
    setItems((l) => l.map((x) => (x.id === id ? { ...x, enabled } : x)));
    announce(`${s.name}: ${enabled ? labels.on : labels.off}`);
    onToggle?.(id, enabled);
  };
  const install = async (id: string) => {
    const s = items.find((x) => x.id === id);
    if (!s || s.installed || installing.includes(id)) return;
    setInstalling((l) => [...l, id]);
    announce(`${labels.installing} ${s.name}`);
    const wait = new Promise((r) => window.setTimeout(r, INSTALL_MS));
    await Promise.all([wait, Promise.resolve(onInstall?.(id))]);
    // Installed: the card keeps its check a moment, then leaves Discover and the skill lands among yours
    setItems((l) =>
      l.map((x) =>
        x.id === id ? { ...x, installed: true, enabled: true, uses: 0 } : x,
      ),
    );
    announce(`${s.name}: ${labels.done}`);
    window.setTimeout(() => {
      setInstalling((l) => l.filter((x) => x !== id));
      setFresh(id);
    }, 800);
  };
  const remove = (id: string) => {
    const s = items.find((x) => x.id === id);
    if (!s) return;
    setItems((l) =>
      l.map((x) =>
        x.id === id ? { ...x, installed: false, enabled: false } : x,
      ),
    );
    announce(`${s.name}: removed`);
    onRemove?.(id);
  };

  const ws = useWorkArea({
    tabs: [
      {
        id: "skill",
        title: skill ? skill.name : labels.skills,
        icon: skill?.icon ?? AiMagicIcon,
        content: skill ? (
          <SkillPanel
            key={skill.id}
            skill={skill}
            installing={installing.includes(skill.id) && !skill.installed}
            now={now}
            labels={labels}
            onToggle={(on) => toggle(skill.id, on)}
            onInstall={() => install(skill.id)}
            onRemove={() => remove(skill.id)}
            onPermissions={() => onNavigate?.("Permissions")}
          />
        ) : (
          <div className="ui-agk-panel ui-agk-panel--empty">
            <EmptyState bare title={labels.noSkill} text={labels.noSkillText} />
          </div>
        ),
      },
    ],
    defaultTabs: ["skill"],
    newTab: false,
  });
  const create = (skill: Skill) => {
    setItems((l) => [...l.filter((x) => x.id !== skill.id), skill]);
    setCreating(false);
    setCat("all");
    setQuery("");
    setFresh(skill.id);
    setSelected(skill.id);
    ws.show("skill");
    announce(`${skill.name}: ${labels.done}`);
    onCreate?.(skill);
  };
  const browse = () => {
    setCreating(false);
    setCat("all");
    setQuery("");
    window.setTimeout(() => {
      const sec = discoverRef.current;
      sec?.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      sec
        ?.querySelector<HTMLElement>("[data-skill]")
        ?.focus({ preventScroll: true });
    }, 30);
  };
  const open = (id: string) => {
    setSelected(id);
    ws.show("skill");
    onSelect?.(id);
  };

  const targets = () => [
    ...(listRef.current?.querySelectorAll<HTMLElement>("[data-skill]") ?? []),
  ];
  const step = (dir: number) => {
    const l = targets();
    if (!l.length) return;
    const i = l.indexOf(document.activeElement as HTMLElement);
    (i < 0
      ? (l.find((r) => r.dataset.skill === selected) ?? l[0])
      : l[Math.min(l.length - 1, Math.max(0, i + dir))]
    )?.focus();
  };
  const onKey = (e: globalThis.KeyboardEvent) => {
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      e.isComposing
    )
      return;
    const t = document.activeElement;
    if (t && t !== document.body && !root.current?.contains(t)) return;
    if (isTyping(t) || document.querySelector(".ui-agk-modal")) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "/") {
      e.preventDefault();
      return searchRef.current?.focus();
    }
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
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.skill === undefined) return;
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft"
    ) {
      e.preventDefault();
      step(e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1);
    }
  };

  return (
    <AppShell
      active="Skills"
      nav={nav}
      groups={groups}
      workspace={workspace}
      workspaceMeta="Pro · Personal"
      sideCards={false}
      workArea={ws}
      panelTitle="Skill"
      panelWidth={{ default: 380, min: 300, max: 520 }}
      onNavigate={onNavigate}
      {...props}
    >
      <style href="ui-screen-agent-skills" precedence="default">
        {css}
      </style>
      <div ref={root} className="ui-agk">
        <header className="ui-agk-head">
          <h1 className="ui-agk-title">{labels.skills}</h1>
          <label className="ui-agk-search">
            <Icon icon={Search01Icon} size={14} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={labels.search}
              aria-label={labels.search}
              aria-keyshortcuts="/"
              aria-controls="ui-agk-list"
              dir="auto"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (query) setQuery("");
                  else e.currentTarget.blur();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  targets()[0]?.focus();
                }
              }}
            />
          </label>
          <button
            ref={newBtn}
            type="button"
            className="ui-agk-btn ui-agk-head__new"
            aria-label={labels.newSkill}
            aria-haspopup="dialog"
            onClick={() => setCreating(true)}
          >
            <Icon icon={Add01Icon} size={14} />
            <span>{labels.newSkill}</span>
          </button>
        </header>

        <div className="ui-agk-scroll">
          <div
            ref={listRef}
            id="ui-agk-list"
            className="ui-agk-body"
            onKeyDown={onListKey}
          >
            {cats.length > 2 && (
              <div
                className="ui-agk-chips"
                role="tablist"
                aria-label={labels.categories}
                onKeyDown={(e) => rove(e, cats, cat, setCat)}
              >
                {cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={cat === c}
                    tabIndex={cat === c ? 0 : -1}
                    onClick={() => setCat(c)}
                  >
                    {c === "all" ? labels.all : c}
                  </button>
                ))}
              </div>
            )}
            {mine.length === 0 && more.length === 0 ? (
              <div className="ui-agk-center">
                <EmptyState
                  bare
                  icon={q ? Search01Icon : AiMagicIcon}
                  title={q ? labels.noMatch : labels.emptyInstalled}
                  text={q ? labels.noMatchText : labels.emptyInstalledText}
                  action={
                    q ? (
                      <button
                        type="button"
                        className="ui-agk-btn"
                        onClick={() => setQuery("")}
                      >
                        {labels.clear}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ui-agk-btn"
                        onClick={() => setCreating(true)}
                      >
                        <Icon icon={Add01Icon} size={14} />
                        <span>{labels.newSkill}</span>
                      </button>
                    )
                  }
                />
              </div>
            ) : (
              <>
                <section className="ui-agk-sect" aria-label={labels.installed}>
                  <h2 className="ui-agk-shead">
                    {labels.installed}
                    <span
                      key={mine.length}
                      className="ui-agk-shead__n ui-agk-num"
                    >
                      {mine.length}
                    </span>
                  </h2>
                  {mine.length ? (
                    <ul className="ui-agk-tiles">
                      {mine.map((s) => (
                        <SkillTile
                          key={s.id}
                          skill={s}
                          labels={labels}
                          selected={s.id === selected}
                          fresh={s.id === fresh}
                          onOpen={() => open(s.id)}
                          onToggle={(on) => toggle(s.id, on)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="ui-agk-note">
                      {q ? labels.noMatch : labels.emptyInstalledText}
                    </p>
                  )}
                </section>
                {more.length > 0 && (
                  <section
                    ref={discoverRef}
                    className="ui-agk-sect ui-agk-sect--discover"
                    aria-label={labels.discover}
                  >
                    <h2 className="ui-agk-shead">
                      {labels.discover}
                      <span className="ui-agk-shead__n ui-agk-num">
                        {more.filter((s) => !s.installed).length}
                      </span>
                    </h2>
                    <p className="ui-agk-shead__text">{labels.discoverText}</p>
                    <ul className="ui-agk-tiles">
                      {more.map((s) => (
                        <SkillCard
                          key={s.id}
                          skill={s}
                          labels={labels}
                          selected={s.id === selected}
                          state={
                            s.installed
                              ? "done"
                              : installing.includes(s.id)
                                ? "installing"
                                : "idle"
                          }
                          onOpen={() => open(s.id)}
                          onInstall={() => install(s.id)}
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
        {creating &&
          root.current?.closest(".ui-as-app") &&
          createPortal(
            <NewSkillDialog
              categories={cats.filter((c) => c !== "all")}
              taken={items.map((x) => x.id)}
              onCreate={create}
              onBrowse={browse}
              onClose={() => {
                setCreating(false);
                newBtn.current?.focus();
              }}
            />,
            root.current.closest(".ui-as-app") as Element,
          )}
        <p className="ui-agk-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </AppShell>
  );
}

/* ---------- Your skills ---------- */

/** A skill's mark: its icon in its color on a light tile of the same color */
function SkillMark({ skill, size = 24 }: { skill: Skill; size?: number }) {
  return (
    <span
      className="ui-agk-mark"
      style={{
        ["--agk-tone" as string]: toneOf(skill.tone),
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      <Icon icon={skill.icon ?? AiMagicIcon} size={Math.round(size * 0.58)} />
    </span>
  );
}

/** Runs per day for the last 14 days – given, or spread from this week's uses so the demo has a shape */
function dailyOf(s: Skill) {
  if (s.daily?.length) return s.daily.slice(-14);
  const u = s.uses ?? 0;
  let seed = [...s.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return Array.from({ length: 14 }, (_, i) =>
    u
      ? Math.max(
          0,
          Math.round((u / 7) * (i < 7 ? 0.7 : 1) * (0.35 + rnd() * 1.3)),
        )
      : 0,
  );
}

/** Two weeks of runs as bars – last week faint, this week in the skill's color; they grow in from the baseline */
function Runs({ skill, labels }: { skill: Skill; labels: Labels }) {
  const values = dailyOf(skill);
  // A round top for the y axis: 0, half and top as labels – 1, 2 or 5 times a power of ten per step
  const raw = Math.max(1, ...values) / 2;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * pow).find((x) => x >= raw) ?? raw,
  );
  const top = step * 2;
  const total = values.slice(-7).reduce((a, v) => a + v, 0);
  const off = skill.enabled === false;
  // Nothing to draw yet – Ran lately already says so
  if (!values.some(Boolean)) return null;
  return (
    <section className="ui-agk-section" aria-label={labels.runs}>
      <h3 className="ui-agk-label ui-agk-runs__head">
        {labels.runs}
        <span className="ui-agk-faint ui-agk-num">{`${number0.format(skill.uses || total)}× ${labels.thisWeek}`}</span>
      </h3>
      <div
        className="ui-agk-chart"
        style={{ ["--agk-tone" as string]: toneOf(skill.tone) }}
        data-off={off || undefined}
        aria-hidden="true"
      >
        <div className="ui-agk-chart__y ui-agk-num">
          {[top, step, 0].map((v) => (
            <span key={v}>{number0.format(v)}</span>
          ))}
        </div>
        <div className="ui-agk-chart__plot">
          <i />
          <i />
          <i />
          <div className="ui-agk-runs">
            {values.map((v, i) => (
              <span
                key={i}
                data-now={i >= values.length - 7 || undefined}
                style={{
                  height: v ? `${Math.max(4, (v / top) * 100)}%` : "2px",
                  animationDelay: `${i * 24}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <span />
        <div className="ui-agk-runs__axis">
          <span>{labels.twoWeeksAgo}</span>
          <span>{labels.today}</span>
        </div>
      </div>
    </section>
  );
}

/** One installed skill as a calm card: icon and name with its switch, what it does, and where it comes from */
function SkillTile({
  skill: s,
  labels,
  selected,
  fresh,
  onOpen,
  onToggle,
}: {
  skill: Skill;
  labels: Labels;
  selected: boolean;
  fresh: boolean;
  onOpen: () => void;
  onToggle: (on: boolean) => void;
}) {
  const on = s.enabled !== false;
  const ref = useRef<HTMLLIElement>(null);
  // Just installed: bring it into view so you see it land
  useEffect(() => {
    if (fresh)
      ref.current?.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [fresh]);
  return (
    <li
      ref={ref}
      className="ui-agk-card"
      data-selected={selected || undefined}
      data-off={!on || undefined}
      data-fresh={fresh || undefined}
    >
      <button
        type="button"
        className="ui-agk-card__main"
        data-skill={s.id}
        aria-current={selected || undefined}
        aria-label={`${s.name}: ${s.description}. ${sourceText(s, labels)}${s.uses ? `, ${s.uses}× ${labels.thisWeek}` : ""}${on ? "" : `, ${labels.off}`}`}
        onClick={onOpen}
      >
        <span className="ui-agk-card__top">
          <SkillMark skill={s} size={20} />
          <span className="ui-agk-card__name" dir="auto" title={s.name}>
            {s.name}
          </span>
        </span>
        <span className="ui-agk-card__desc" dir="auto">
          {s.description}
        </span>
        <span className="ui-agk-card__foot">
          <span className="ui-agk-chip" dir="auto">
            {sourceText(s, labels)}
          </span>
        </span>
      </button>
      <span className="ui-agk-card__corner">
        <Switch
          on={on}
          label={`${s.name}: ${on ? labels.turnOff : labels.turnOn}`}
          onChange={onToggle}
        />
      </span>
    </li>
  );
}

/** On / off – a role="switch": blue and to the right while the agent uses the skill */
export function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="ui-agk-switch"
      onClick={() => onChange(!on)}
    >
      <span className="ui-agk-switch__knob" aria-hidden="true" />
    </button>
  );
}

/** A skill to add – the same calm card: icon and name with Install, what it does, who made it and how many use it */
function SkillCard({
  skill: s,
  labels,
  selected,
  state,
  onOpen,
  onInstall,
}: {
  skill: Skill;
  labels: Labels;
  selected: boolean;
  state: "idle" | "installing" | "done";
  onOpen: () => void;
  onInstall: () => void;
}) {
  return (
    <li
      className="ui-agk-card"
      data-selected={selected || undefined}
      data-state={state}
    >
      <button
        type="button"
        className="ui-agk-card__main"
        data-skill={s.id}
        aria-label={`${s.name}: ${s.description}. ${sourceText(s, labels)}`}
        onClick={onOpen}
      >
        <span className="ui-agk-card__top">
          <SkillMark skill={s} size={20} />
          <span className="ui-agk-card__name" dir="auto" title={s.name}>
            {s.name}
          </span>
        </span>
        <span className="ui-agk-card__desc" dir="auto">
          {s.description}
        </span>
        <span className="ui-agk-card__foot">
          <span className="ui-agk-chip" dir="auto">
            {sourceText(s, labels)}
          </span>
          {s.installs ? (
            <span className="ui-agk-card__count ui-agk-num">
              {compact.format(s.installs)} use it
            </span>
          ) : null}
        </span>
      </button>
      <span className="ui-agk-card__corner">
        <InstallButton
          state={state}
          labels={labels}
          name={s.name}
          onInstall={onInstall}
          small
        />
      </span>
    </li>
  );
}

/** Install that becomes a ring filling while it installs, then a check */
export function InstallButton({
  state,
  labels,
  name,
  onInstall,
  wide,
  small,
}: {
  state: "idle" | "installing" | "done";
  labels: Labels;
  name: string;
  onInstall: () => void;
  wide?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className="ui-agk-btn ui-agk-install"
      data-state={state}
      data-wide={wide || undefined}
      data-small={small || undefined}
      aria-label={
        state === "idle"
          ? `${labels.install} ${name}`
          : state === "installing"
            ? `${labels.installing} ${name}`
            : `${name}: ${labels.done}`
      }
      aria-disabled={state !== "idle" || undefined}
      title={
        small && state === "idle" ? `${labels.install} ${name}` : undefined
      }
      onClick={() => state === "idle" && onInstall()}
    >
      <span className="ui-agk-install__icon" aria-hidden="true">
        {state === "idle" ? (
          <Icon icon={small ? Add01Icon : Download04Icon} size={14} />
        ) : state === "installing" ? (
          <svg viewBox="0 0 16 16" width="14" height="14">
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.2"
            />
            <circle
              className="ui-agk-install__ring"
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength="1"
              transform="rotate(-90 8 8)"
            />
          </svg>
        ) : (
          <Icon icon={Tick02Icon} size={14} />
        )}
      </span>
      <span
        key={state}
        className={small ? "ui-agk-sr" : "ui-agk-install__text"}
      >
        {state === "idle"
          ? labels.install
          : state === "installing"
            ? labels.installing
            : labels.done}
      </span>
    </button>
  );
}

/* ---------- New skill ---------- */

/** Twinkle order for the agent mark – a diagonal wave */
const WAVE = [0, 120, 240, 120, 240, 360, 240, 360, 480];
/** The agent's 3×3 pixel mark – affectUI's agent icon; it twinkles while the agent writes */
function AgentMark({ busy }: { busy?: boolean }) {
  const cells = [1, 0, 1, 1, 1, 1, 1, 0, 1];
  return (
    <span
      className="ui-agk-agent"
      data-busy={busy || undefined}
      aria-hidden="true"
    >
      {cells.map((on, i) => (
        <i
          key={i}
          data-on={on ? "" : undefined}
          style={{ animationDelay: `${WAVE[i]}ms` }}
        />
      ))}
    </span>
  );
}

type Draft = {
  name: string;
  description: string;
  instructions: string;
  category: string;
  from?: string;
};
type Step = "choose" | "describe" | "writing" | "write" | "upload";

const IDEAS = [
  "Summarise every sales call into the CRM",
  "Turn bug reports into issues with steps to reproduce",
  "Write LinkedIn posts in our voice",
];
const ICON_FOR: Record<string, IconSvgElement> = {
  Writing: QuillWrite01Icon,
  Research: GlobalSearchIcon,
  Engineering: CodeIcon,
  Data: Table01Icon,
  Documents: Note01Icon,
};
const TONE_FOR: Record<string, string> = {
  Writing: "pink",
  Research: "blue",
  Engineering: "green",
  Data: "teal",
  Documents: "orange",
};
const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "skill";
const titleCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A short name from a sentence: without the verb it starts with, up to the first little word – "Write LinkedIn posts in our voice" → "LinkedIn posts" */
function nameFrom(words: string[]) {
  const stop =
    /^(in|into|for|with|to|from|on|at|by|every|each|and|that|so|our|my|the|a|an)$/i;
  // A lead-in before a comma ("Every Friday, …") is when, not what
  const comma = words.findIndex((x) => /,$/.test(x));
  const what = (
    comma >= 0 && comma < words.length - 2 ? words.slice(comma + 1) : words
  ).map((x) => x.replace(/[,;:]$/, ""));
  let w = what.length > 2 ? what.slice(1) : what;
  while (w.length > 1 && stop.test(w[0])) w = w.slice(1);
  const cut = w.findIndex((x, i) => i > 0 && stop.test(x));
  const name = (cut > 0 ? w.slice(0, cut) : w.slice(0, 4)).join(" ");
  return titleCase(name || words.slice(0, 4).join(" "));
}

/** What the agent drafts from a sentence – a name from its first words, the sentence as when to use it, three steps */
function draftFrom(text: string, categories: string[]): Draft {
  const words = text
    .replace(/[.!?]+$/, "")
    .split(/\s+/)
    .filter(Boolean);
  const guess = /code|bug|pull request|deploy|issue/i.test(text)
    ? "Engineering"
    : /sheet|data|number|chart|crm/i.test(text)
      ? "Data"
      : /research|find|compare/i.test(text)
        ? "Research"
        : "Writing";
  return {
    name: nameFrom(words),
    description: titleCase(text.trim()),
    instructions: [
      "Reads what you share and finds what else it needs",
      `${titleCase(words.join(" "))}`,
      "Checks the result and asks you when something is unclear",
    ].join("\n"),
    category: categories.includes(guess) ? guess : (categories[0] ?? "Writing"),
  };
}

/** A SKILL.md: name and description from its front matter or first heading, the rest as instructions */
function draftFromFile(file: File, text: string, categories: string[]): Draft {
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const field = (k: string) =>
    front &&
    new RegExp(`^${k}:\\s*(.+)$`, "m")
      .exec(front[1])?.[1]
      .trim()
      .replace(/^["']|["']$/g, "");
  const body = front ? text.slice(front[0].length) : text;
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith("#"));
  const base = file.name.replace(/\.(md|zip)$/i, "").replace(/[-_]+/g, " ");
  return {
    name: titleCase(
      field("name")?.replace(/[-_]+/g, " ") ||
        heading ||
        (base.toLowerCase() === "skill" ? "" : base),
    ),
    description:
      field("description") || para?.replace(/\s+/g, " ").slice(0, 200) || "",
    instructions: body.replace(/^#\s+.+$/m, "").trim(),
    category: categories[0] ?? "Writing",
    from: file.name,
  };
}

/**
 * New skill – a window with four ways in: describe it and the agent writes it, write it yourself, upload a SKILL.md,
 * or browse the skills others use. Describing and uploading both end in the same form, filled in, to check and create
 */
export function NewSkillDialog({
  categories,
  taken,
  onCreate,
  onBrowse,
  onClose,
}: {
  categories: string[];
  taken: string[];
  onCreate: (skill: Skill) => void;
  onBrowse: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [idea, setIdea] = useState("");
  const [draft, setDraft] = useState<Draft>({
    name: "",
    description: "",
    instructions: "",
    category: categories[0] ?? "Writing",
  });
  const [over, setOver] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Each step starts on its first control
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-first]")?.focus();
  }, [step]);

  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const write = () => {
    if (!idea.trim()) return;
    setStep("writing");
    timer.current = window.setTimeout(() => {
      setDraft(draftFrom(idea, categories));
      setStep("write");
    }, 1600);
  };
  const read = async (file?: File | null) => {
    if (!file) return;
    const text =
      /\.md$/i.test(file.name) || file.type.startsWith("text")
        ? await file.text()
        : "";
    setDraft(draftFromFile(file, text, categories));
    setStep("write");
  };
  const ready = draft.name.trim() && draft.description.trim();
  const submit = () => {
    if (!ready) return;
    let id = slug(draft.name);
    for (let n = 2; taken.includes(id); n++) id = `${slug(draft.name)}-${n}`;
    const steps = draft.instructions
      .split("\n")
      .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim())
      .filter((l) => l && !l.startsWith("#"))
      .slice(0, 8);
    onCreate({
      id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category,
      icon: ICON_FOR[draft.category] ?? AiMagicIcon,
      tone: TONE_FOR[draft.category] ?? "pink",
      source: "yours",
      version: "1.0",
      installed: true,
      enabled: true,
      uses: 0,
      steps: steps.length ? steps : undefined,
    });
  };

  const back =
    step === "choose"
      ? null
      : () =>
          setStep(
            step === "write" && draft.from === undefined && idea
              ? "describe"
              : "choose",
          );
  const heads: Record<Step, [string, string]> = {
    choose: [
      "New skill",
      "Teach your agent something it can do again and again",
    ],
    describe: [
      "Describe it",
      "Say what it should do – your agent writes the skill",
    ],
    writing: ["Describe it", "Your agent is writing the skill"],
    write: [
      draft.from
        ? "Check the skill"
        : idea
          ? "Check the skill"
          : "Write it yourself",
      draft.from
        ? `From ${draft.from}`
        : idea
          ? "Your agent wrote it – change anything you like"
          : "Name it, say when to use it and what to do",
    ],
    upload: ["Upload a file", "A SKILL.md – or a .zip with its files"],
  };
  const options = [
    {
      key: "describe",
      title: "Describe it",
      text: "Say what it should do – your agent writes it",
      mark: <AgentMark />,
      go: () => setStep("describe"),
    },
    {
      key: "write",
      title: "Write it yourself",
      text: "Name, when to use it and the steps",
      icon: QuillWrite01Icon,
      go: () => (
        setIdea(""),
        setDraft({
          name: "",
          description: "",
          instructions: "",
          category: categories[0] ?? "Writing",
        }),
        setStep("write")
      ),
    },
    {
      key: "upload",
      title: "Upload a file",
      text: "A SKILL.md or a .zip with its files",
      icon: Upload01Icon,
      go: () => (setIdea(""), setStep("upload")),
    },
    {
      key: "browse",
      title: "Browse skills",
      text: "Skills others use, ready to add",
      icon: Store01Icon,
      go: onBrowse,
    },
  ];

  return (
    <div
      className="ui-agk-modal"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        className="ui-agk-modal__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-agk-new-title"
        aria-describedby="ui-agk-new-sub"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            return onClose();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (step === "describe") write();
            else if (step === "write") submit();
          }
          if (e.key !== "Tab") return;
          const list = [
            ...e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input, textarea, [tabindex]:not([tabindex='-1'])",
            ),
          ].filter((el) => el.offsetParent !== null);
          const first = list[0];
          const last = list[list.length - 1];
          if (e.shiftKey && document.activeElement === first)
            (e.preventDefault(), last?.focus());
          else if (!e.shiftKey && document.activeElement === last)
            (e.preventDefault(), first?.focus());
        }}
      >
        <header className="ui-agk-modal__head">
          {back ? (
            <button
              type="button"
              className="ui-agk-modal__icon-btn"
              aria-label="Back"
              onClick={back}
              disabled={step === "writing"}
            >
              <Icon icon={ArrowLeft01Icon} size={15} />
            </button>
          ) : null}
          <span className="ui-agk-modal__heading">
            <b id="ui-agk-new-title">{heads[step][0]}</b>
            <small id="ui-agk-new-sub">{heads[step][1]}</small>
          </span>
          <button
            type="button"
            className="ui-agk-modal__icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon icon={Cancel01Icon} size={15} />
          </button>
        </header>

        <div key={step} className="ui-agk-modal__body">
          {step === "choose" && (
            <ul
              className="ui-agk-ways"
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const l = [
                  ...e.currentTarget.querySelectorAll<HTMLElement>(
                    ".ui-agk-way",
                  ),
                ];
                const i = l.indexOf(document.activeElement as HTMLElement);
                l[
                  (i + (e.key === "ArrowDown" ? 1 : l.length - 1)) % l.length
                ]?.focus();
              }}
            >
              {options.map((o, i) => (
                <li key={o.key}>
                  <button
                    type="button"
                    className="ui-agk-way"
                    data-first={i === 0 || undefined}
                    onClick={o.go}
                  >
                    <span className="ui-agk-way__icon" aria-hidden="true">
                      {o.mark ?? <Icon icon={o.icon!} size={16} />}
                    </span>
                    <span className="ui-agk-way__text">
                      <b>{o.title}</b>
                      <small>{o.text}</small>
                    </span>
                    <Icon icon={ArrowRight01Icon} size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === "describe" && (
            <div className="ui-agk-form">
              <label className="ui-agk-field">
                <span>What should your agent be able to do?</span>
                <textarea
                  data-first
                  rows={4}
                  value={idea}
                  placeholder="e.g. Every Friday, collect what shipped and write a short update for the team"
                  dir="auto"
                  onChange={(e) => setIdea(e.target.value)}
                />
              </label>
              <div className="ui-agk-ideas" aria-label="Ideas">
                {IDEAS.map((t) => (
                  <button key={t} type="button" onClick={() => setIdea(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "writing" && (
            <div className="ui-agk-writing" role="status">
              <AgentMark busy />
              <span>Writing the skill…</span>
            </div>
          )}

          {step === "upload" && (
            <label
              className="ui-agk-drop"
              data-over={over || undefined}
              onDragOver={(e) => (e.preventDefault(), setOver(true))}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                read(e.dataTransfer.files[0]);
              }}
            >
              <input
                data-first
                type="file"
                accept=".md,.zip,text/markdown,application/zip"
                className="ui-agk-drop__input"
                onChange={(e) => read(e.target.files?.[0])}
              />
              <span className="ui-agk-drop__icon" aria-hidden="true">
                <Icon icon={Upload01Icon} size={18} />
              </span>
              <b>Drop a SKILL.md here</b>
              <small>or click to choose a file · .md or .zip</small>
            </label>
          )}

          {step === "write" && (
            <div className="ui-agk-form">
              <label className="ui-agk-field">
                <span>Name</span>
                <input
                  data-first
                  value={draft.name}
                  placeholder="Weekly status report"
                  maxLength={60}
                  dir="auto"
                  onChange={(e) => set({ name: e.target.value })}
                />
              </label>
              <label className="ui-agk-field">
                <span>When to use it</span>
                <textarea
                  rows={2}
                  value={draft.description}
                  placeholder="When I ask for an update on what happened this week"
                  maxLength={200}
                  dir="auto"
                  onChange={(e) => set({ description: e.target.value })}
                />
              </label>
              <label className="ui-agk-field">
                <span>
                  Instructions <em>one step per line</em>
                </span>
                <textarea
                  rows={5}
                  value={draft.instructions}
                  placeholder={
                    "Collect merged work and closed tasks\nGroup it by project\nPut what needs an answer first"
                  }
                  dir="auto"
                  onChange={(e) => set({ instructions: e.target.value })}
                />
              </label>
              <div className="ui-agk-field">
                <span id="ui-agk-new-cat">Category</span>
                <div
                  className="ui-agk-chips ui-agk-chips--form"
                  role="radiogroup"
                  aria-labelledby="ui-agk-new-cat"
                >
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={draft.category === c}
                      onClick={() => set({ category: c })}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {(step === "describe" || step === "write") && (
          <footer className="ui-agk-modal__foot">
            <button
              type="button"
              className="ui-agk-modal__cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            {step === "describe" ? (
              <button
                type="button"
                className="ui-agk-modal__go"
                disabled={!idea.trim()}
                onClick={write}
              >
                Write the skill
              </button>
            ) : (
              <button
                type="button"
                className="ui-agk-modal__go"
                disabled={!ready}
                onClick={submit}
              >
                Create skill
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ---------- Panel ---------- */

/**
 * The skill: its mark, name, who made it; Turn on / off and Remove, or Install; when it steps in, what it does step by
 * step, what it needs – with the way to Permissions – and where it ran lately
 */
function SkillPanel({
  skill: s,
  installing,
  now,
  labels,
  onToggle,
  onInstall,
  onRemove,
  onPermissions,
}: {
  skill: Skill;
  installing: boolean;
  now: number;
  labels: Labels;
  onToggle: (on: boolean) => void;
  onInstall: () => void;
  onRemove: () => void;
  onPermissions: () => void;
}) {
  const on = s.enabled !== false;
  return (
    <div className="ui-agk-panel" aria-label={s.name}>
      <div className="ui-agk-panel__head">
        <SkillMark skill={s} size={40} />
        <span className="ui-agk-panel__titles">
          <h2 className="ui-agk-panel__title" dir="auto">
            {s.name}
          </h2>
          <span className="ui-agk-panel__sub ui-agk-num" dir="auto">
            {sourceText(s, labels)}
            {s.version ? ` · v${s.version}` : ""}
            {s.installs ? ` · ${compact.format(s.installs)} use it` : ""}
          </span>
        </span>
      </div>
      <p className="ui-agk-panel__desc" dir="auto">
        {s.description}
      </p>

      <div className="ui-agk-panel__acts">
        {s.installed ? (
          <>
            <button
              type="button"
              className="ui-agk-btn"
              onClick={() => onToggle(!on)}
            >
              <span
                className="ui-agk-dot"
                data-on={on || undefined}
                aria-hidden="true"
              />
              <span>{on ? labels.turnOff : labels.turnOn}</span>
            </button>
            {s.source !== "builtin" && (
              <button
                type="button"
                className="ui-agk-btn ui-agk-btn--quiet"
                onClick={onRemove}
              >
                <Icon icon={Delete02Icon} size={14} />
                <span>{labels.remove}</span>
              </button>
            )}
          </>
        ) : (
          <InstallButton
            state={installing ? "installing" : "idle"}
            labels={labels}
            name={s.name}
            onInstall={onInstall}
            wide
          />
        )}
      </div>

      {s.installed && <Runs skill={s} labels={labels} />}

      {s.triggers?.length ? (
        <section className="ui-agk-section" aria-label={labels.runsWhen}>
          <h3 className="ui-agk-label">{labels.runsWhen}</h3>
          <ul className="ui-agk-triggers">
            {s.triggers.map((t) => (
              <li key={t} dir="auto">
                “{t}”
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s.steps?.length ? (
        <section className="ui-agk-section" aria-label={labels.steps}>
          <h3 className="ui-agk-label">{labels.steps}</h3>
          <ol className="ui-agk-steps">
            {s.steps.map((t, i) => (
              <li key={t}>
                <span className="ui-agk-steps__n ui-agk-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span dir="auto">{t}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {s.needs?.length ? (
        <section className="ui-agk-section" aria-label={labels.needs}>
          <h3 className="ui-agk-label">{labels.needs}</h3>
          <div className="ui-agk-needs">
            {s.needs.map((n) => (
              <span key={n} className="ui-agk-need" dir="auto">
                <Icon icon={Shield01Icon} size={12} />
                {n}
              </span>
            ))}
            <button
              type="button"
              className="ui-agk-link"
              onClick={onPermissions}
            >
              {labels.permissions}
              <Icon icon={ArrowRight01Icon} size={12} />
            </button>
          </div>
        </section>
      ) : null}

      {s.installed && (
        <section className="ui-agk-section" aria-label={labels.usedIn}>
          <h3 className="ui-agk-label">{labels.usedIn}</h3>
          {s.usedIn?.length ? (
            <ul className="ui-agk-used">
              {s.usedIn.map((u) => (
                <li key={u.task + u.at}>
                  <span className="ui-agk-used__task" dir="auto" title={u.task}>
                    {u.task}
                  </span>
                  <span className="ui-agk-faint">{agoLong(u.at, now)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-agk-note">{labels.notUsed}</p>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-agk, .ui-agk-panel {
  --ui-agk-focus: rgba(0, 96, 226, 0.7);
  --agk-out: cubic-bezier(0.23, 1, 0.32, 1);
  --agk-card-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 1px -1px rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --agk-line: rgba(0, 0, 0, 0.06);
  --agk-edge: rgba(0, 0, 0, 0.09);
  --agk-edge-soft: rgba(0, 0, 0, 0.05);
  --agk-edge-hover: rgba(0, 0, 0, 0.16);
  --agk-head: color-mix(in srgb, var(--ink) 4.5%, var(--panel));
  --agk-well: color-mix(in srgb, var(--ink) 3.5%, var(--card));
  --agk-blue: #0190fe;
  --agk-c-purple: #a651f0;
  --agk-c-orange: #f28a2e;
  --agk-c-teal: #13b3a0;
  --agk-c-blue: #0190fe;
  --agk-c-amber: #e8b000;
  --agk-c-pink: #ee3e9e;
  --agk-c-green: #5fc88a;
}
:where(.dark, [data-theme="dark"]) :is(.ui-agk, .ui-agk-panel) {
  --ui-agk-focus: rgba(77, 141, 255, 0.8);
  --agk-card-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --agk-line: rgba(255, 255, 255, 0.07);
  --agk-edge: rgba(255, 255, 255, 0.09);
  --agk-edge-soft: rgba(255, 255, 255, 0.06);
  --agk-edge-hover: rgba(255, 255, 255, 0.18);
  --agk-blue: #4fb0fe;
  --agk-c-purple: #b98af0;
  --agk-c-orange: #f2a15c;
  --agk-c-teal: #4fc3b4;
  --agk-c-blue: #4fb0fe;
  --agk-c-amber: #e6c24d;
  --agk-c-pink: #f06db5;
  --agk-c-green: #7dcf9f;
}
.ui-agk { position: relative; container: ui-agk / inline-size; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; background: var(--panel); }
.ui-agk-num { font-variant-numeric: tabular-nums; }
.ui-agk-faint { color: var(--faint); }
.ui-agk-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:is(.ui-agk, .ui-agk-panel) :focus-visible { outline: 2px solid var(--ui-agk-focus); outline-offset: 2px; }
:is(.ui-agk, .ui-agk-panel) :is(input, textarea):focus-visible { outline: none; }

/* ---------- Head ---------- */
.ui-agk-head { display: flex; flex: none; align-items: center; gap: 12px; height: var(--as-head-h, 48px); padding: 0 12px 0 20px; box-shadow: inset 0 -0.5px 0 var(--line); }
.ui-agk-title { flex: none; margin: 0; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); }
.ui-agk-search { display: flex; flex: 0 1 220px; align-items: center; gap: 6px; min-width: 0; height: 28px; margin-left: auto; padding: 0 8px; border-radius: 6px; background: var(--chip); color: var(--faint); cursor: text; transition: box-shadow 140ms ease, background-color 140ms ease; }
.ui-agk-search:focus-within { background: var(--card); box-shadow: var(--card-shadow-hover); }
.ui-agk-search > svg { flex: none; }
.ui-agk-search input { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; background: none; font: inherit; font-size: 13px; color: var(--ink); outline: none; appearance: none; }
.ui-agk-search input::placeholder { color: var(--placeholder); }
.ui-agk-search input::-webkit-search-cancel-button { display: none; }

.ui-agk-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 6px; background: var(--card); box-shadow: var(--agk-card-shadow); font-size: 13px; font-weight: 500; color: var(--ink); white-space: nowrap; transition: box-shadow 140ms ease, background-color 140ms ease, color 140ms ease; }
.ui-agk-btn:hover { box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06); }
.ui-agk-btn > svg { flex: none; color: var(--muted); }
.ui-agk-btn:has(> svg:first-child) { padding-left: 8px; }
.ui-agk-btn--quiet { background: none; box-shadow: none; color: var(--text); }
.ui-agk-btn--quiet:hover { background: var(--chip); box-shadow: none; color: var(--ink); }
.ui-agk-btn:active:not([aria-disabled]) { transform: scale(0.97); }

/* ---------- Your skills ---------- */
.ui-agk-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.ui-agk-center { display: grid; min-height: 320px; place-items: center; padding: 40px 24px 80px; }
.ui-agk-body { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 28px; box-sizing: border-box; width: 100%; max-width: 752px; margin: 0 auto; padding: 20px 16px 40px; }
.ui-agk-chips { display: flex; gap: 4px; margin: -4px -16px -14px; padding: 4px 16px; overflow-x: auto; scrollbar-width: none; }
.ui-agk-chips::-webkit-scrollbar { display: none; }
.ui-agk-chips button { flex: none; height: 28px; padding: 0 8px; border-radius: 6px; font-size: 13px; color: var(--muted); white-space: nowrap; transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease; }
.ui-agk-chips button:hover { color: var(--ink); }
.ui-agk-chips button:is([aria-selected="true"], [aria-checked="true"]) { background: var(--chip); color: var(--ink); }
.ui-agk-sect { display: grid; grid-template-columns: minmax(0, 1fr); }
.ui-agk-shead { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); }
.ui-agk-shead:has(+ .ui-agk-shead__text) { margin-bottom: 0; }
.ui-agk-shead__n { display: inline-block; font-size: 12px; font-weight: 400; color: var(--faint); animation: ui-agk-tick 420ms var(--agk-out); }
.ui-agk-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.ui-agk-shead__text { margin: 0 0 12px; font-size: 12.5px; line-height: 18px; color: var(--muted); }
.ui-agk-mark { display: grid; flex: none; place-items: center; border-radius: 7px; background: color-mix(in srgb, var(--agk-tone) 14%, var(--card)); color: var(--agk-tone); transition: filter 200ms ease, opacity 200ms ease; }

.ui-agk-switch { position: relative; flex: none; width: 30px; height: 18px; border-radius: 9px; background: color-mix(in srgb, var(--ink) 16%, var(--card)); transition: background-color 200ms ease; }
.ui-agk-switch[aria-checked="true"] { background: var(--agk-blue); }
.ui-agk-switch__knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: transform 240ms var(--agk-out); }
.ui-agk-switch[aria-checked="true"] .ui-agk-switch__knob { transform: translateX(12px); }
.ui-agk-card .ui-agk-switch { width: 26px; height: 16px; }
.ui-agk-card .ui-agk-switch__knob { width: 12px; height: 12px; }
.ui-agk-card .ui-agk-switch[aria-checked="true"] .ui-agk-switch__knob { transform: translateX(10px); }

/* Cards – calm: a hairline, small icon and name, two quiet lines, one chip; the switch or Install in the corner */
.ui-agk-card { position: relative; display: flex; min-width: 0; border-radius: 10px; background: var(--card); box-shadow: inset 0 0 0 0.5px var(--agk-edge); transition: box-shadow 160ms ease, background-color 160ms ease, opacity 300ms ease; }
.ui-agk-card:hover { background: color-mix(in srgb, var(--ink) 1.8%, var(--card)); box-shadow: inset 0 0 0 0.5px var(--agk-edge-soft), 0 1px 2px rgba(0, 0, 0, 0.04), 0 3px 8px -4px rgba(0, 0, 0, 0.08); }
.ui-agk-card[data-fresh] { animation: ui-agk-land 560ms var(--agk-out) both, ui-agk-glow 1200ms ease both; }
/* Landed: a light blue wave runs over the card once */
.ui-agk-card[data-fresh]::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(105deg, transparent 35%, color-mix(in srgb, var(--agk-blue) 13%, transparent) 50%, transparent 65%) no-repeat; background-size: 250% 100%; animation: ui-agk-wave 900ms cubic-bezier(0.4, 0, 0.2, 1) 220ms both; }
.ui-agk-card[data-state="done"] { animation: ui-agk-leave 900ms ease 400ms both; }
.ui-agk-card__main { display: grid; flex: 1; align-content: start; gap: 6px; min-width: 0; padding: 12px 14px; border-radius: 10px; text-align: left; }
.ui-agk-card__main:focus-visible { outline-offset: -2px; }
.ui-agk-card__top { display: flex; align-items: center; gap: 8px; min-width: 0; height: 24px; padding-right: 36px; }
.ui-agk-card__name { overflow: hidden; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-agk-card__desc { display: -webkit-box; min-height: 36px; overflow: hidden; overflow-wrap: anywhere; font-size: 12.5px; line-height: 18px; color: var(--muted); -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ui-agk-card__foot { display: flex; align-items: center; gap: 8px; min-width: 0; margin-top: 4px; }
.ui-agk-card__count { margin-left: auto; font-size: 11.5px; color: var(--faint); white-space: nowrap; }
.ui-agk-card__corner { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; height: 24px; }
.ui-agk-chip { max-width: 100%; overflow: hidden; padding: 0 6px; border-radius: 5px; background: var(--chip); font-size: 11.5px; line-height: 18px; color: var(--muted); white-space: nowrap; text-overflow: ellipsis; }
.ui-agk-card[data-off] :is(.ui-agk-card__name, .ui-agk-card__desc) { color: var(--faint); }
.ui-agk-card[data-off] .ui-agk-mark { filter: grayscale(1); opacity: 0.55; }
.ui-agk-card .ui-agk-mark { border-radius: 5px; }
/* Runs: two weeks as bars in the panel */
.ui-agk-runs__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.ui-agk-runs__head > span { font-weight: 400; }
.ui-agk-chart { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 10px; row-gap: 6px; margin-top: 8px; }
.ui-agk-chart__y { display: flex; flex-direction: column; justify-content: space-between; height: 84px; margin: -6px 0; font-size: 11px; line-height: 12px; color: var(--faint); text-align: right; }
.ui-agk-chart__plot { position: relative; height: 72px; }
.ui-agk-chart__plot > i { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--agk-line); }
.ui-agk-chart__plot > i:nth-child(1) { top: 0; }
.ui-agk-chart__plot > i:nth-child(2) { top: 50%; }
.ui-agk-chart__plot > i:nth-child(3) { bottom: 0; border-top-style: solid; }
.ui-agk-runs { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 4px; }
.ui-agk-runs > span { flex: none; width: 9px; border-radius: 3px 3px 1px 1px; background: color-mix(in srgb, var(--agk-tone) 18%, var(--card)); transform-origin: bottom; animation: ui-agk-bar 520ms var(--agk-out) both; transition: background-color 200ms ease; }
.ui-agk-runs > span[data-now] { background: color-mix(in srgb, var(--agk-tone) 70%, var(--card)); }
.ui-agk-chart[data-off] .ui-agk-runs > span { background: color-mix(in srgb, var(--ink) 12%, var(--card)); }
.ui-agk-runs__axis { display: flex; justify-content: space-between; padding: 0 2px; font-size: 11px; color: var(--faint); }
/* Install: the button turns into a ring that fills, then a check – the width glides with the words */
.ui-agk-install { min-width: 96px; }
.ui-agk-install[data-wide] { min-width: 120px; }
.ui-agk-install[data-small] { min-width: 0; width: 24px; height: 24px; padding: 0; box-shadow: inset 0 0 0 0.5px var(--agk-edge-hover); background: var(--card); }
.ui-agk-install[data-small][data-state="done"] { box-shadow: none; background: color-mix(in srgb, var(--agk-blue) 12%, var(--card)); }
.ui-agk-install[data-state="installing"] { color: var(--agk-blue); cursor: default; }
.ui-agk-install[data-state="done"] { background: color-mix(in srgb, var(--agk-blue) 12%, var(--card)); box-shadow: none; color: var(--agk-blue); cursor: default; }
.ui-agk-install__icon { display: grid; place-items: center; width: 14px; height: 14px; color: var(--muted); }
.ui-agk-install:not([data-state="idle"]) .ui-agk-install__icon { color: inherit; }
.ui-agk-install[data-state="done"] .ui-agk-install__icon { animation: ui-agk-pop 360ms var(--agk-out) both; }
.ui-agk-install__ring { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ui-agk-fill ${INSTALL_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.ui-agk-install__text { animation: ui-agk-swap 240ms var(--agk-out) both; }

/* ---------- Panel ---------- */
.ui-agk-panel { display: flex; flex-direction: column; gap: 28px; padding: 8px 8px 24px; }
.ui-agk-panel--empty { display: grid; min-height: 240px; place-items: center; }
.ui-agk-panel :focus-visible { outline-offset: -2px; }
.ui-agk-panel__head { display: flex; align-items: center; gap: 12px; }
.ui-agk-panel__titles { display: grid; min-width: 0; }
.ui-agk-panel__title { margin: 0; overflow: hidden; font-size: 15px; font-weight: 500; line-height: 22px; color: var(--ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-agk-panel__sub { overflow: hidden; font-size: 12px; line-height: 16px; color: var(--muted); white-space: nowrap; text-overflow: ellipsis; }
.ui-agk-panel__desc { margin: -14px 0 0; overflow-wrap: anywhere; font-size: 13px; line-height: 20px; color: var(--text); }
.ui-agk-panel__acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: -12px; }
.ui-agk-panel__uses { margin-left: auto; font-size: 12px; }
.ui-agk-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
.ui-agk-dot[data-on] { background: var(--agk-blue); }
.ui-agk-section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.ui-agk-label { margin: 0; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--muted); }
.ui-agk-triggers, .ui-agk-steps { display: grid; gap: 8px; margin: 0; padding: 12px 14px; list-style: none; border-radius: 10px; background: var(--agk-well); }
.ui-agk-triggers li { font-size: 13px; line-height: 20px; color: var(--text); overflow-wrap: anywhere; }
.ui-agk-steps li { display: flex; align-items: flex-start; gap: 10px; min-width: 0; font-size: 13px; line-height: 20px; color: var(--text); }
.ui-agk-steps li > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.ui-agk-steps__n { display: grid; flex: none; place-items: center; width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; background: var(--card); box-shadow: 0 0 0 0.5px var(--agk-line); font-size: 11px; font-weight: 500; color: var(--muted); }
.ui-agk-needs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ui-agk-need { display: inline-flex; max-width: 100%; overflow-wrap: anywhere; align-items: center; gap: 5px; padding: 3px 9px 3px 7px; border-radius: 8px; box-shadow: inset 0 0 0 0.5px var(--agk-line); font-size: 12.5px; line-height: 18px; color: var(--text); }
.ui-agk-need > svg { flex: none; color: var(--muted); }
.ui-agk-link { display: inline-flex; align-items: center; gap: 2px; height: 24px; margin: 0 -6px 0 auto; padding: 0 6px; border-radius: 6px; font-size: 12px; color: var(--muted); transition: background-color 140ms ease, color 140ms ease; }
.ui-agk-link:hover { background: var(--chip); color: var(--ink); }
.ui-agk-used { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ui-agk-used li { display: flex; align-items: baseline; gap: 12px; font-size: 13px; line-height: 20px; color: var(--text); }
.ui-agk-used__task { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ui-agk-used li > .ui-agk-faint { flex: none; font-size: 12px; }
.ui-agk-note { margin: 0; font-size: 13px; color: var(--faint); }

.ui-as-app[data-panel="closed"] .ui-agk-head { padding-right: 52px; }
@container ui-as (max-width: 900px) {
  .ui-agk-head { padding-left: 46px; padding-right: 52px; }
}
@container ui-agk (max-width: 560px) {
  .ui-agk-head { gap: 8px; }
  .ui-agk-search { flex: 0 0 28px; justify-content: center; padding: 0 7px; }
  .ui-agk-search input::placeholder { color: transparent; }
  .ui-agk-search:focus-within, .ui-agk-search:has(input:not(:placeholder-shown)) { flex: 1 1 auto; justify-content: flex-start; }
  .ui-agk-head__new > span { display: none; }
  .ui-agk-head .ui-agk-btn.ui-agk-head__new { width: 28px; padding: 0; }
  .ui-agk-tiles { grid-template-columns: minmax(0, 1fr); }
  .ui-agk-body { padding: 12px 12px 32px; }
  .ui-agk-card__desc { min-height: 0; }
  .ui-agk-chips { margin: -4px -12px -14px; padding: 4px 12px; }
}

/* ---------- New skill ---------- */
.ui-agk-modal { --ui-agk-focus: rgba(0, 96, 226, 0.7); --agk-out: cubic-bezier(0.23, 1, 0.32, 1); --agk-blue: #0190fe; --agk-well: color-mix(in srgb, var(--ink) 3.5%, var(--card)); position: absolute; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: rgba(0, 0, 0, 0.16); animation: ui-agk-fade 180ms ease both; }
:where(.dark, [data-theme="dark"]) .ui-agk-modal { --ui-agk-focus: rgba(77, 141, 255, 0.8); --agk-blue: #4fb0fe; background: rgba(0, 0, 0, 0.4); }
.ui-agk-modal :focus-visible { outline: 2px solid var(--ui-agk-focus); outline-offset: 2px; }
.ui-agk-modal :is(input, textarea):focus-visible { outline: none; }
.ui-agk-modal__box { display: flex; flex-direction: column; width: 100%; max-width: 480px; max-height: 100%; overflow: auto; border-radius: 16px; background: var(--card); box-shadow: 0 0 0 0.5px var(--line-strong, rgba(0, 0, 0, 0.12)), 0 24px 48px -12px rgba(0, 0, 0, 0.25); animation: ui-agk-in 240ms var(--agk-out) both; }
.ui-agk-modal__head { display: flex; align-items: center; gap: 8px; padding: 16px 12px 4px 20px; }
.ui-agk-modal__head:has(> .ui-agk-modal__icon-btn:first-child) { padding-left: 12px; }
.ui-agk-modal__heading { display: grid; flex: 1; min-width: 0; }
.ui-agk-modal__heading b { font-size: 15px; font-weight: 500; line-height: 22px; color: var(--ink); }
.ui-agk-modal__heading small { font-size: 12.5px; line-height: 18px; color: var(--muted); }
.ui-agk-modal__icon-btn { display: grid; flex: none; place-items: center; width: 28px; height: 28px; border-radius: 7px; color: var(--muted); transition: background-color 140ms ease, color 140ms ease; }
.ui-agk-modal__icon-btn:hover:not(:disabled) { background: var(--hover); color: var(--ink); }
.ui-agk-modal__icon-btn:disabled { opacity: 0.4; }
.ui-agk-modal__head > .ui-agk-modal__icon-btn:first-child { align-self: flex-start; margin-top: 4px; }
.ui-agk-modal__head > .ui-agk-modal__icon-btn:last-child { align-self: flex-start; }
.ui-agk-modal__body { padding: 16px 20px 20px; animation: ui-agk-swap 220ms var(--agk-out) both; }
.ui-agk-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; box-shadow: inset 0 0.5px 0 var(--line); }
.ui-agk-modal__cancel { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 13px; color: var(--text); transition: background-color 140ms ease; }
.ui-agk-modal__cancel:hover { background: var(--hover); color: var(--ink); }
.ui-agk-modal__go { height: 32px; padding: 0 14px; border-radius: 8px; background: var(--ink); font-size: 13px; font-weight: 500; color: var(--card); transition: opacity 140ms ease; }
.ui-agk-modal__go:hover:not(:disabled) { opacity: 0.88; }
.ui-agk-modal__go:disabled { opacity: 0.35; cursor: default; }
/* The four ways in */
.ui-agk-ways { display: grid; gap: 4px; margin: -4px -8px 0; padding: 0; list-style: none; }
.ui-agk-way { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px 10px 10px; border-radius: 10px; text-align: left; color: var(--faint); transition: background-color 140ms ease, color 140ms ease; }
.ui-agk-way:hover { background: var(--agk-well); color: var(--muted); }
.ui-agk-way__icon { display: grid; flex: none; place-items: center; width: 36px; height: 36px; border-radius: 9px; background: var(--card); box-shadow: inset 0 0 0 0.5px var(--line-strong, rgba(0, 0, 0, 0.12)); color: var(--ink); }
.ui-agk-way__text { display: grid; flex: 1; min-width: 0; }
.ui-agk-way__text b { font-size: 13px; font-weight: 500; line-height: 20px; color: var(--ink); }
.ui-agk-way__text small { font-size: 12.5px; line-height: 18px; color: var(--muted); }
/* Form */
.ui-agk-form { display: grid; gap: 16px; }
.ui-agk-field { display: grid; gap: 6px; }
.ui-agk-field > span { font-size: 12px; font-weight: 500; line-height: 16px; color: var(--muted); }
.ui-agk-field > span em { margin-left: 4px; font-style: normal; font-weight: 400; color: var(--faint); }
.ui-agk-field :is(input, textarea) { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 0; border-radius: 8px; background: var(--agk-well); box-shadow: inset 0 0 0 0.5px transparent; font: inherit; font-size: 13px; line-height: 20px; color: var(--ink); resize: vertical; outline: none; transition: box-shadow 140ms ease, background-color 140ms ease; }
.ui-agk-field input { height: 36px; }
.ui-agk-field :is(input, textarea)::placeholder { color: var(--placeholder, var(--faint)); }
.ui-agk-field :is(input, textarea):focus { background: var(--card); box-shadow: inset 0 0 0 1px var(--line-strong, rgba(0, 0, 0, 0.16)), 0 1px 2px rgba(0, 0, 0, 0.04); }
.ui-agk-chips--form { margin: 0; padding: 0; flex-wrap: wrap; overflow: visible; }
.ui-agk-ideas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: -4px; }
.ui-agk-ideas button { max-width: 100%; padding: 4px 10px; border-radius: 8px; box-shadow: inset 0 0 0 0.5px var(--line-strong, rgba(0, 0, 0, 0.12)); font-size: 12.5px; line-height: 18px; text-align: left; color: var(--text); transition: background-color 140ms ease; }
.ui-agk-ideas button:hover { background: var(--agk-well); color: var(--ink); }
.ui-agk-writing { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0 36px; font-size: 13px; color: var(--muted); }
.ui-agk-writing .ui-agk-agent { transform: scale(1.5); margin-bottom: 4px; }
.ui-agk-drop { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 32px 16px; border-radius: 12px; background: var(--agk-well); box-shadow: inset 0 0 0 1px var(--line); text-align: center; cursor: pointer; transition: background-color 160ms ease, box-shadow 160ms ease; }
.ui-agk-drop[data-over] { background: color-mix(in srgb, var(--agk-blue) 8%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--agk-blue) 45%, transparent); }
.ui-agk-drop:has(:focus-visible) { outline: 2px solid var(--ui-agk-focus); outline-offset: 2px; }
.ui-agk-drop__input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.ui-agk-drop__icon { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 8px; border-radius: 10px; background: var(--card); box-shadow: inset 0 0 0 0.5px var(--line-strong, rgba(0, 0, 0, 0.12)); color: var(--ink); }
.ui-agk-drop b { font-size: 13px; font-weight: 500; color: var(--ink); }
.ui-agk-drop small { font-size: 12.5px; color: var(--muted); }
/* The agent mark: 3×3 pixels in the agent blue; they twinkle in a diagonal wave while it writes */
.ui-agk-agent { --agk-mark: rgba(0, 96, 226, 0.78); display: grid; flex: none; grid-template-columns: repeat(3, 3px); grid-auto-rows: 3px; gap: 1.5px; place-content: center; width: 16px; height: 16px; }
:where(.dark, [data-theme="dark"]) .ui-agk-agent { --agk-mark: rgba(77, 141, 255, 0.85); }
.ui-agk-agent i { border-radius: 0.75px; background: var(--agk-mark); opacity: 0; }
.ui-agk-agent i[data-on] { opacity: 1; }
.ui-agk-agent[data-busy] i { animation: ui-agk-pixel 1.2s ease-in-out infinite both; }
.ui-agk-agent[data-busy] i:not([data-on]) { opacity: 0.16; }
@keyframes ui-agk-pixel { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
@keyframes ui-agk-fade { from { opacity: 0; } }
@keyframes ui-agk-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } }

@keyframes ui-agk-fill { to { stroke-dashoffset: 0; } }
@keyframes ui-agk-pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes ui-agk-swap { from { opacity: 0; transform: translateY(3px); } }
@keyframes ui-agk-tick { from { opacity: 0.3; transform: translateY(3px); } }
@keyframes ui-agk-leave { to { opacity: 0.45; } }
@keyframes ui-agk-bar { from { transform: scaleY(0); } }
@keyframes ui-agk-land { from { opacity: 0; transform: translateY(10px) scale(0.97); filter: blur(4px); } }
@keyframes ui-agk-glow { 0%, 40% { box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--agk-blue) 35%, transparent), 0 4px 14px -6px color-mix(in srgb, var(--agk-blue) 22%, transparent); } }
@keyframes ui-agk-wave { from { background-position: 120% 0; opacity: 1; } 85% { opacity: 1; } to { background-position: -20% 0; opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .ui-agk-install__ring { animation: none; stroke-dashoffset: 0; }
  .ui-agk-install__icon, .ui-agk-install__text, .ui-agk-shead__n, .ui-agk-card[data-state="done"], .ui-agk-card[data-fresh], .ui-agk-card[data-fresh]::after, .ui-agk-runs > span, .ui-agk-modal, .ui-agk-modal__box, .ui-agk-modal__body { animation: none; }
  .ui-agk-agent[data-busy] i { animation-duration: 2.4s; }
}
@media (pointer: coarse) {
  .ui-agk-btn, .ui-agk-chips button, .ui-agk-search, .ui-agk-link, .ui-agk-modal__icon-btn, .ui-agk-modal__cancel, .ui-agk-modal__go { min-height: 36px; }
  .ui-agk-switch, .ui-agk-card .ui-agk-switch { width: 40px; height: 24px; border-radius: 12px; }
  .ui-agk-switch__knob, .ui-agk-card .ui-agk-switch__knob { width: 20px; height: 20px; }
  .ui-agk-switch[aria-checked="true"] .ui-agk-switch__knob, .ui-agk-card .ui-agk-switch[aria-checked="true"] .ui-agk-switch__knob { transform: translateX(16px); }
}
`;
