// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * Settings / Profile – the personal profile page of an app's settings, in a single file.
 * A settings sidebar (‹ Settings, search, Personal and Workspace), then the page: a note that the profile applies to
 * every workspace, a card of rows – picture, first and last name, role, email – and sections for time preferences,
 * personal context for the assistant and the password. Every field works; changes save on their own and answer
 * with a short toast.
 * Sits in the affectUI App Shell; Button from the library, icons from the Hugeicons free set.
 */

import { useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import {
  Briefcase01Icon,
  Calendar03Icon,
  ChartIncreaseIcon,
  CodeIcon,
  Globe02Icon,
  Megaphone01Icon,
  PackageIcon,
  PaintBoardIcon,
  Settings02Icon,
  Cancel01Icon,
  CreditCardIcon,
  Notification01Icon,
  InformationCircleIcon,
  Settings01Icon,
  Shield01Icon,
  SlidersHorizontalIcon,
  Upload04Icon,
  UserIcon,
  UserMultiple02Icon,
  CpuIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Button } from "@/components/ui/button-clean";
import { TextArea } from "@/components/ui/text-area-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { Select as LibrarySelect } from "@/components/ui/select-clean";
import { AppShell, Icon, Loading, Skeleton, useToast, type AppShellProps, type ShellGroup } from "@/components/app-shell";

/* ---------- Sample content – replace with your own data ---------- */

/** The settings sidebar: personal pages first, then the workspace's */
export const settingsGroups: ShellGroup[] = [
  {
    label: "Personal",
    items: [
      { label: "Profile", icon: UserIcon },
      { label: "Preferences", icon: SlidersHorizontalIcon },
      { label: "Notifications", icon: Notification01Icon },
      { label: "Privacy", icon: Shield01Icon },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "General", icon: Settings01Icon },
      { label: "Members", icon: UserMultiple02Icon },
      { label: "Models", icon: CpuIcon },
      { label: "Security", icon: SquareLock02Icon },
      { label: "Billing", icon: CreditCardIcon },
    ],
  },
];

const roles = ["Engineering", "Design", "Product", "Marketing", "Sales", "Operations", "Other"];
// Every menu item gets an icon – one per role, a globe for time zones, a calendar for the week
const roleIcons: Record<string, IconSvgElement> = {
  Engineering: CodeIcon,
  Design: PaintBoardIcon,
  Product: PackageIcon,
  Marketing: Megaphone01Icon,
  Sales: ChartIncreaseIcon,
  Operations: Settings02Icon,
  Other: Briefcase01Icon,
};
const timezones = ["Europe/Vienna", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];
const weekStarts = ["Monday", "Sunday", "Saturday"];
const CONTEXT_MAX = 500;

export type ProfileValues = {
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  timezone: string;
  weekStart: string;
  context: string;
  /** An image URL; without one the initials show */
  avatar?: string;
  hasPassword?: boolean;
};

const sample: ProfileValues = {
  firstName: "Alex",
  lastName: "Morgan",
  email: "alex@acme.com",
  timezone: "Europe/Vienna",
  weekStart: "Monday",
  context: "",
  hasPassword: false,
};

export type SettingsProfileScreenProps = Pick<AppShellProps, "onNavigate" | "workspace" | "className"> & {
  /** The person's profile – the sample profile when left out */
  profile?: ProfileValues;
  /** Called with the whole profile whenever something is saved */
  onSave?: (profile: ProfileValues) => void;
  /** While the profile loads: the picture, fields, choices, personal context and password note as gray shapes in the shape of the real ones */
  loading?: boolean;
};

/** The first letters of first and last name, as people see them */
const initials = (first: string, last: string) =>
  [first, last]
    .map((part) => Array.from(part.trim())[0] ?? "")
    .join("")
    .toUpperCase();

export function SettingsProfileScreen({ profile = sample, onSave, loading, ...props }: SettingsProfileScreenProps) {
  const [values, setValues] = useState(profile);
  const saved = useRef(profile);
  const [toast, showToast] = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadBtn = useRef<HTMLButtonElement>(null);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  // Saves what changed – on blur for text, at once for choices
  const commit = (next: ProfileValues = values, note = "Profile updated") => {
    if (JSON.stringify(next) === JSON.stringify(saved.current)) return;
    saved.current = next;
    onSave?.(next);
    showToast(note);
  };
  const choose = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    commit(next);
  };

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return showToast("Pick an image under 10 MB");
    choose("avatar", URL.createObjectURL(file));
  };

  const name = `${values.firstName} ${values.lastName}`.trim();

  return (
    <AppShell
      active="Profile"
      nav={[]}
      groups={settingsGroups}
      back={{ title: "Settings" }}
      user={{ name: name || "You", avatar: values.avatar }}
      {...props}
    >
      <style href="ui-settings-profile" precedence="default">
        {css}
      </style>
      <div className="ui-as-page ui-sp">
        <h1 className="ui-as-page-title">Profile</h1>
        <p className="ui-as-page-sub">
          Manage your personal details. <a href="#learn-more">Learn more</a>
        </p>

        <p className="ui-sp-note">
          <Icon icon={InformationCircleIcon} size={15} />
          Changes to your profile apply to all of your workspaces.
        </p>

        {/* The person: picture, name, role, email */}
        {loading ? (
          <SettingsSkeleton label="Loading profile">
            <SettingsSkeletonRow
              title="Profile picture"
              note="PNG, JPEG or GIF, under 10 MB"
              control={
                <span className="ui-sp-control">
                  <Skeleton width={40} height={40} radius="50%" />
                  <Button size="sm" variant="secondary" icon={<Icon icon={Upload04Icon} size={15} />} disabled>
                    Upload
                  </Button>
                </span>
              }
            />
            <SettingsSkeletonRow title="First name" control={<SkeletonControl className="ui-sp-field" />} />
            <SettingsSkeletonRow title="Last name" control={<SkeletonControl className="ui-sp-field" />} />
            <SettingsSkeletonRow title="Role" note="Helps tailor suggestions to your work" control={<SkeletonControl className="ui-sp-field" />} />
            <SettingsSkeletonRow
              title="Email"
              control={
                <span className="ui-sp-control">
                  <SkeletonControl className="ui-sp-field ui-sp-field--quiet" />
                  <Button size="sm" variant="secondary" disabled>
                    Change
                  </Button>
                </span>
              }
            />
          </SettingsSkeleton>
        ) : (
          <section className="ui-sp-card" aria-label="Profile">
            <div className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Profile picture</b>
                <small>PNG, JPEG or GIF, under 10 MB</small>
              </span>
              <span className="ui-sp-control">
                <span className="ui-sp-avatar">
                  {values.avatar ? <img src={values.avatar} alt="" /> : <span aria-hidden="true">{initials(values.firstName, values.lastName) || "?"}</span>}
                  {values.avatar && (
                    <button
                      type="button"
                      className="ui-sp-avatar__remove"
                      aria-label="Remove picture"
                      onClick={() => {
                        choose("avatar", undefined);
                        // The × goes with the picture – focus moves on to Upload
                        setTimeout(() => uploadBtn.current?.focus());
                      }}
                    >
                      <Icon icon={Cancel01Icon} size={10} />
                    </button>
                  )}
                </span>
                <Button ref={uploadBtn} size="sm" variant="secondary" icon={<Icon icon={Upload04Icon} size={15} />} onClick={() => fileInput.current?.click()}>
                  {values.avatar ? "Replace" : "Upload"}
                </Button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif" hidden onChange={pickImage} />
              </span>
            </div>

            <label className="ui-sp-row">
              <span className="ui-sp-label">
                <b>First name</b>
              </span>
              <TextField className="ui-sp-field" value={values.firstName} autoComplete="given-name" onChange={(e) => set("firstName", e.target.value)} onBlur={() => commit()} />
            </label>

            <label className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Last name</b>
              </span>
              <TextField className="ui-sp-field" value={values.lastName} autoComplete="family-name" onChange={(e) => set("lastName", e.target.value)} onBlur={() => commit()} />
            </label>

            <div className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Role</b>
                <small>Helps tailor suggestions to your work</small>
              </span>
              <Select label="Role" value={values.role} placeholder="Choose your role" options={roles} icon={(o) => roleIcons[o] ?? UserIcon} onChange={(v) => choose("role", v)} />
            </div>

            <div className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Email</b>
              </span>
              <span className="ui-sp-control">
                <TextField className="ui-sp-field ui-sp-field--quiet" value={values.email} readOnly aria-label="Email" title={values.email} />
                <Button size="sm" variant="secondary" onClick={() => showToast(`We sent a link to change it to ${values.email}`)}>
                  Change
                </Button>
              </span>
            </div>
          </section>
        )}

        {/* When the person works */}
        <header className="ui-sp-head">
          <h2>Time preferences</h2>
          <p>Used for reminders, schedules and reports.</p>
        </header>
        {loading ? (
          <SettingsSkeleton label="Loading time preferences">
            <SettingsSkeletonRow title="Timezone" control={<SkeletonControl className="ui-sp-field" />} />
            <SettingsSkeletonRow title="Start week on" control={<SkeletonControl className="ui-sp-field" />} />
          </SettingsSkeleton>
        ) : (
          <section className="ui-sp-card" aria-label="Time preferences">
            <div className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Timezone</b>
              </span>
              <Select label="Timezone" value={values.timezone} options={timezones} icon={() => Globe02Icon} onChange={(v) => choose("timezone", v)} />
            </div>
            <div className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Start week on</b>
              </span>
              <Select label="Start week on" value={values.weekStart} options={weekStarts} icon={() => Calendar03Icon} onChange={(v) => choose("weekStart", v)} />
            </div>
          </section>
        )}

        {/* What the assistant should know */}
        <header className="ui-sp-head">
          <h2>Personal context</h2>
          <p>Describe what you do and how you work, so the assistant can adapt to you.</p>
        </header>
        {loading ? (
          <SkeletonTextArea label="Loading personal context" lines={["88%", "64%"]}>
            <TextArea className="ui-sp-context" minRows={4} maxRows={12} maxLength={CONTEXT_MAX} counter defaultValue="" aria-label="Personal context" />
          </SkeletonTextArea>
        ) : (
          <TextArea
            className="ui-sp-context"
            minRows={4}
            maxRows={12}
            maxLength={CONTEXT_MAX}
            counter
            value={values.context}
            placeholder="E.g. I lead product at a small team, prefer short answers and write in British English."
            aria-label="Personal context"
            onChange={(e) => set("context", e.target.value)}
            onBlur={() => commit(values, "Context saved")}
          />
        )}

        {/* Signing in */}
        {loading ? (
          <SettingsSkeleton label="Loading password" className="ui-sp-card ui-sp-card--alone">
            <SettingsSkeletonRow title="Password" note={<SkeletonLine width={220} bar={8} />} control={<SkeletonControl kind="button" width={108} />} />
          </SettingsSkeleton>
        ) : (
          <section className="ui-sp-card ui-sp-card--alone" aria-label="Password">
            <div className="ui-sp-row">
              <span className="ui-sp-label">
                <b>Password</b>
                <small>{values.hasPassword ? "Last changed 3 months ago" : "You sign in with a link sent to your email"}</small>
              </span>
              <Button size="sm" variant="secondary" onClick={() => showToast(`Check ${values.email} to ${values.hasPassword ? "change" : "set"} your password`)}>
                {values.hasPassword ? "Change password" : "Add password"}
              </Button>
            </div>
          </section>
        )}
      </div>
      {toast}
    </AppShell>
  );
}

/** The library's Select at the row's width: the value with its icon, the options in a list under it */
function Select({
  label,
  value,
  placeholder,
  options,
  icon,
  onChange,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  options: string[];
  icon: (option: string) => IconSvgElement;
  onChange: (value: string) => void;
}) {
  return (
    <LibrarySelect
      className="ui-sp-field"
      aria-label={label}
      value={value ?? null}
      placeholder={placeholder}
      options={options.map((o) => ({ value: o, label: o, icon: <Icon icon={icon(o)} size={16} /> }))}
      onChange={onChange}
    />
  );
}

/* ---------- Loading: skeletons every settings page shares ---------- */

/** The skeletons' few styles – React 19 adds them to the page once, however many skeletons render */
const SkeletonStyle = () => (
  <style href="ui-settings-skeleton" precedence="default">
    {skeletonCss}
  </style>
);

/**
 * One card (or any area) of a settings page while it loads: the real card's class, announced as loading, fading in a
 * beat late. Fill it with SettingsSkeletonRow – or the area's own rows – so the card is as tall as the loaded one.
 */
export function SettingsSkeleton({ label = "Loading", className = "ui-sp-card", children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <Loading label={label} className={className}>
      <SkeletonStyle />
      {children}
    </Loading>
  );
}

/**
 * A settings row while it loads – the row's own class (ui-sp-row, ui-sg-row …), so padding and min-height match.
 * Static copy stays as text; a title or note that is data takes a SkeletonLine. `control` is the right side: a
 * SkeletonControl, SkeletonSwitch or a real button, disabled. `children` replaces the whole left side.
 */
export function SettingsSkeletonRow({
  row = "ui-sp-row",
  className,
  title,
  note,
  control,
  children,
}: {
  /** The real row's class; its label class is derived from it (ui-sg-row → ui-sg-label) */
  row?: string;
  /** Extra classes on the row, e.g. ui-ss-domain */
  className?: string;
  title?: ReactNode;
  note?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={className ? `${row} ${className}` : row} data-skel="">
      {children ?? (
        <span className={row.replace(/-row$/, "-label")}>
          {title != null && <b>{title}</b>}
          {note != null && <small>{note}</small>}
        </span>
      )}
      {control}
    </div>
  );
}

/**
 * A gray bar centered in one line of text. The line keeps the text's own line height (1lh), so whatever holds it is
 * exactly as tall as with the text in it. ~10px bars for 13–14px text, ~8px for 12px meta.
 */
export function SkeletonLine({ width, bar = 10, line = "1lh", inline, className }: { width: number | string; bar?: number; line?: number | string; inline?: boolean; className?: string }) {
  const cls = ["ui-sp-skel-line", inline && "ui-sp-skel-line--inline", className].filter(Boolean).join(" ");
  return (
    <span className={cls} style={{ height: line }}>
      <SkeletonStyle />
      <Skeleton width={width} height={bar} />
    </span>
  );
}

/**
 * A field, select or small button while it loads: pass the real control's class (ui-sg-field, ui-ss-select …) and it
 * takes that width – in the narrow layout too. 32px tall like the library's fields (38px on touch screens);
 * `kind="button"` is 24px (32px on touch) like a small Button.
 */
export function SkeletonControl({ className, kind = "field", width, radius }: { className?: string; kind?: "field" | "button"; width?: number | string; radius?: number | string }) {
  const style: CSSProperties | undefined = width !== undefined ? { width } : undefined;
  return (
    <span className={["ui-sp-skel-control", kind === "button" && "ui-sp-skel-control--button", className].filter(Boolean).join(" ")} style={style}>
      <SkeletonStyle />
      <Skeleton width="100%" height="100%" radius={radius ?? (kind === "button" ? "var(--aui-radius, 6px)" : "var(--aui-radius, 7px)")} />
    </span>
  );
}

/** A switch's track while it loads – 32 × 20, 40 × 24 on touch screens, like the library's Switch */
export function SkeletonSwitch() {
  return (
    <span className="ui-sp-skel-switch">
      <SkeletonStyle />
      <Skeleton width="100%" height="100%" radius={999} />
    </span>
  );
}

/**
 * A control whose size only it knows (a segmented control, a tab bar) while it loads: the real one, invisible and
 * out of reach, holds the space; a gray shape covers it. `inline` for a chip in running text.
 */
export function SkeletonGhost({ radius, inline, className, children }: { radius?: number | string; inline?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={["ui-sp-skel-ghost", inline && "ui-sp-skel-ghost--inline", className].filter(Boolean).join(" ")} data-skel="" inert>
      <SkeletonStyle />
      {children}
      <Skeleton className="ui-sp-skel-ghost__fill" width="auto" height="auto" radius={radius ?? "var(--aui-radius, 7px)"} />
    </span>
  );
}

/**
 * A text area while its text loads: the real Text Area – empty, out of reach – keeps its exact height, label and
 * hint; gray lines sit where the text goes. Pass `labelled` when the Text Area has a label above the box, and
 * `inside` when it already sits in a SettingsSkeleton (it then doesn't announce itself a second time).
 */
export function SkeletonTextArea({ label = "Loading", lines, labelled, inside, children }: { label?: string; lines: (number | string)[]; labelled?: boolean; inside?: boolean; children: ReactNode }) {
  const field = (
    <div className="ui-sp-skel-area" data-skel="" data-labelled={labelled || undefined} inert>
      <SkeletonStyle />
      {children}
      <span className="ui-sp-skel-area__lines" aria-hidden="true">
        {lines.map((w, i) => (
          <SkeletonLine key={i} width={w} line={20} />
        ))}
      </span>
    </div>
  );
  return inside ? field : <Loading label={label}>{field}</Loading>;
}

/* ---------- Styles ---------- */

/** The skeletons' styles – injected by the helpers above, on every settings page that uses them */
const skeletonCss = /* css */ `
/* Loading: the same cards and rows, gray shapes in place of the data – nothing moves when it lands */
.ui-as [data-skel] { pointer-events: none; }
.ui-sp-skel-line { display: flex; align-items: center; min-width: 0; max-width: 100%; }
.ui-sp-skel-line--inline { display: inline-flex; vertical-align: top; }
.ui-sp-skel-control { display: flex; flex: none; height: 32px; max-width: 100%; }
.ui-sp-skel-control--button { height: 24px; }
.ui-sp-skel-switch { display: flex; flex: none; width: 32px; height: 20px; }
@media (pointer: coarse) {
  .ui-sp-skel-control { height: 38px; }
  .ui-sp-skel-control--button { height: 32px; }
  .ui-sp-skel-switch { width: 40px; height: 24px; }
}
.ui-sp-skel-ghost { position: relative; display: inline-flex; flex: none; vertical-align: top; }
/* In running text: the control stays inline, so the line keeps its height */
.ui-sp-skel-ghost--inline { display: inline-block; vertical-align: baseline; }
.ui-sp-skel-ghost > :not(.ui-as-skel, style) { visibility: hidden; }
.ui-sp-skel-ghost__fill { position: absolute; inset: 0; }
/* A text area: the empty field keeps its size, the lines sit where its text starts */
.ui-sp-skel-area { position: relative; }
.ui-sp-skel-area__lines { position: absolute; top: 7px; right: 40px; left: 10px; display: grid; }
.ui-sp-skel-area[data-labelled] .ui-sp-skel-area__lines { top: 33px; }
.ui-sp-skel-area .ui-tac__count, .ui-sp-skel-area .ui-tac__expand { visibility: hidden; }
/* Narrow: a switch stays next to its label, like the real one */
@container ui-as-main (max-width: 600px) {
  .ui-sg-row:has(> .ui-sp-skel-switch) { flex-direction: row; align-items: center; }
}
`;

const css = /* css */ `
/* Settings / Profile – rows in cards, the label on the left and its control on the right */
.ui-sp { max-width: 760px; margin: 0 auto; }

/* A quiet note on the faint frame */
.ui-sp-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 24px 0 0;
  padding: 10px 12px;
  border-radius: var(--aui-radius-lg, 10px);
  background: var(--frame);
  box-shadow: inset 0 0 0 0.5px var(--line);
  font-size: 13px;
  line-height: 20px;
  color: var(--text);
}
.ui-sp-note svg { flex: none; color: var(--muted); }

.ui-sp-head { margin-top: 36px; }
.ui-sp-head h2 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; color: var(--strong); }
.ui-sp-head p { margin: 2px 0 0; font-size: 13px; line-height: 20px; color: var(--muted); }

.ui-sp-card { position: relative; margin-top: 12px; border-radius: calc(var(--aui-radius-lg, 10px) + 2px); background: var(--card); box-shadow: var(--card-shadow); }
.ui-sp-note + .ui-sp-card { margin-top: 16px; }
.ui-sp-card--alone { margin-top: 24px; }

.ui-sp-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 60px; padding: 10px 12px 10px 16px; }
.ui-sp-row + .ui-sp-row { box-shadow: inset 0 0.5px 0 var(--line); }
.ui-sp-label { display: grid; min-width: 0; }
.ui-sp-label b { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--strong); }
.ui-sp-label b, .ui-sp-label small { overflow-wrap: anywhere; }
.ui-sp-label small { overflow: hidden; font-size: 12px; line-height: 16px; color: var(--muted); text-overflow: ellipsis; }
.ui-sp-control { display: flex; flex: none; align-items: center; gap: 8px; min-width: 0; }
.ui-sp-row > :is(.ui-buttonc, .ui-as-anchor), .ui-sp-control > .ui-buttonc { flex: none; }

/* Text fields and selects are the library's Text Field and Select, at a fixed width here */
.ui-sp-field { flex: none; width: 240px; }
.ui-sp-field--quiet { width: 200px; }

/* The picture: initials until there is one; a small × to remove it */
.ui-sp-avatar { position: relative; display: grid; flex: none; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--accent-soft); font-size: 13px; font-weight: 500; color: var(--accent); }
.ui-sp-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.ui-sp-avatar__remove { position: absolute; top: -3px; right: -3px; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--card); box-shadow: var(--card-shadow); color: var(--muted); }
.ui-sp-avatar__remove:hover { color: var(--ink); }
/* A 32px target around the small × */
.ui-sp-avatar__remove::before { content: ""; position: absolute; inset: -7px; }
.ui-sp-avatar__remove:focus-visible { outline: 2px solid var(--ui-as-focus); outline-offset: 2px; box-shadow: var(--card-shadow); color: var(--ink); }

/* Personal context: the library's Text Area */

/* Narrow: each control goes under its label, full width */
@container ui-as-main (max-width: 600px) {
  .ui-sp-row { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 14px; }
  .ui-sp-field { width: 100%; }
  .ui-sp-control { flex: 1; }
  .ui-sp-control .ui-sp-field { flex: 1; width: auto; min-width: 0; }
}
`;
