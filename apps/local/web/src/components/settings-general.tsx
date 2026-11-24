// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * Settings / General – the basics of a workspace, in a single file.
 * The settings sidebar, then the page: a card of rows – the workspace's icon, name and address – a company context
 * the assistant reads with every chat, and a danger zone that deletes the workspace once its name is typed.
 * Every field works; changes save on their own and answer with a short toast.
 * Sits in the affectUI App Shell; Button from the library, icons from the Hugeicons free set.
 */

import { useRef, useState, type ChangeEvent } from "react";
import { Cancel01Icon, Delete02Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button-clean";
import { TextArea } from "@/components/ui/text-area-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { AppShell, Icon, Skeleton, useToast, type AppShellProps } from "@/components/app-shell";
import { SettingsSkeleton, SettingsSkeletonRow, SkeletonControl, SkeletonLine, SkeletonTextArea, settingsGroups } from "@/components/settings-profile";

/* ---------- Sample content – replace with your own data ---------- */

export type WorkspaceValues = {
  name: string;
  /** The part of the address after the domain */
  slug: string;
  /** What the assistant should know about the company – added to every chat */
  context: string;
  /** An image URL; without one the first letter shows */
  icon?: string;
};

const sample: WorkspaceValues = { name: "Acme", slug: "acme", context: "" };
const DOMAIN = "app.workspace.ai/";
const CONTEXT_MAX = 2000;

export type SettingsGeneralScreenProps = Pick<AppShellProps, "onNavigate" | "user" | "className"> & {
  /** The workspace – the sample workspace when left out */
  workspace?: WorkspaceValues;
  /** Called with the whole workspace whenever something is saved */
  onSave?: (workspace: WorkspaceValues) => void;
  /** Called once the deletion is confirmed */
  onDelete?: () => void;
  /** While the workspace loads: its icon, name, address and company context as gray shapes in the shape of the real ones */
  loading?: boolean;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** First character as a whole grapheme, so an emoji or accented letter stays in one piece */
const firstChar = (s: string) => Array.from(s.trim())[0]?.toUpperCase() ?? "";

export function SettingsGeneralScreen({ workspace = sample, onSave, onDelete, loading, ...props }: SettingsGeneralScreenProps) {
  const [values, setValues] = useState(workspace);
  const saved = useRef(workspace);
  const [toast, showToast] = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [wide, setWide] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const deleteBtn = useRef<HTMLButtonElement>(null);
  // Closing the confirm hands focus back to the button that opened it
  const closeDelete = () => {
    setDeleting(false);
    setConfirm("");
    setTimeout(() => deleteBtn.current?.focus());
  };

  const set = <K extends keyof WorkspaceValues>(key: K, value: WorkspaceValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  // Saves what changed – on blur for text, at once for the icon
  const commit = (next: WorkspaceValues = values, note = "Workspace updated") => {
    if (!next.name.trim()) {
      setValues((v) => ({ ...v, name: saved.current.name }));
      return showToast("A workspace needs a name");
    }
    if (JSON.stringify(next) === JSON.stringify(saved.current)) return;
    saved.current = next;
    onSave?.(next);
    showToast(note);
  };

  const pickIcon = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 512 * 1024) return showToast("Pick an image under 512 KB");
    const next = { ...values, icon: URL.createObjectURL(file) };
    setValues(next);
    commit(next, "Icon updated");
  };
  const uploadBtn = useRef<HTMLButtonElement>(null);
  const removeIcon = () => {
    const next = { ...values, icon: undefined };
    setValues(next);
    commit(next, "Icon removed");
    // The × goes with the picture – focus moves on to Upload
    setTimeout(() => uploadBtn.current?.focus());
  };

  // About four characters make a token – enough for a sense of the cost
  const tokens = Math.ceil(values.context.trim().length / 4);
  const canDelete = confirm.trim() === saved.current.name.trim();

  return (
    <AppShell active="General" nav={[]} groups={settingsGroups} back={{ title: "Settings" }} workspace={values.name || "Workspace"} {...props}>
      <style href="ui-settings-general" precedence="default">
        {css}
      </style>
      <div className="ui-as-page ui-sg">
        <h1 className="ui-as-page-title">General</h1>
        <p className="ui-as-page-sub">Set up the basics of your workspace.</p>

        {/* The workspace: icon, name, address */}
        {loading ? (
          <SettingsSkeleton label="Loading workspace" className="ui-sg-card">
            <SettingsSkeletonRow
              row="ui-sg-row"
              title="Workspace icon"
              note="Square, PNG or JPEG, up to 512 KB"
              control={
                <span className="ui-sg-control">
                  <Skeleton width={36} height={36} radius={10} />
                  <Button size="sm" variant="secondary" icon={<Icon icon={Upload04Icon} size={15} />} disabled>
                    Upload
                  </Button>
                </span>
              }
            />
            <SettingsSkeletonRow row="ui-sg-row" title="Workspace name" note="Shown in the sidebar and in invites" control={<SkeletonControl className="ui-sg-field" />} />
            <SettingsSkeletonRow row="ui-sg-row" title="Workspace URL" note="Changing it breaks links people have saved" control={<SkeletonControl className="ui-sg-field" />} />
          </SettingsSkeleton>
        ) : (
          <section className="ui-sg-card" aria-label="Workspace">
            <div className="ui-sg-row">
              <span className="ui-sg-label">
                <b>Workspace icon</b>
                <small>Square, PNG or JPEG, up to 512 KB</small>
              </span>
              <span className="ui-sg-control">
                <span className="ui-sg-icon">
                  {values.icon ? <img src={values.icon} alt="" /> : <span aria-hidden="true">{firstChar(values.name) || "?"}</span>}
                  {values.icon && (
                    <button type="button" className="ui-sg-icon__remove" aria-label="Remove icon" onClick={removeIcon}>
                      <Icon icon={Cancel01Icon} size={10} />
                    </button>
                  )}
                </span>
                <Button ref={uploadBtn} size="sm" variant="secondary" icon={<Icon icon={Upload04Icon} size={15} />} onClick={() => fileInput.current?.click()}>
                  {values.icon ? "Replace" : "Upload"}
                </Button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg" hidden onChange={pickIcon} />
              </span>
            </div>

            <label className="ui-sg-row">
              <span className="ui-sg-label">
                <b>Workspace name</b>
                <small>Shown in the sidebar and in invites</small>
              </span>
              <TextField className="ui-sg-field" value={values.name} maxLength={60} onChange={(e) => set("name", e.target.value)} onBlur={() => commit()} />
            </label>

            <label className="ui-sg-row">
              <span className="ui-sg-label">
                <b>Workspace URL</b>
                <small>Changing it breaks links people have saved</small>
              </span>
              <TextField
                className="ui-sg-field"
                prefix={DOMAIN}
                value={values.slug}
                aria-label="Workspace URL"
                spellCheck={false}
                onChange={(e) => set("slug", slugify(e.target.value) || "")}
                onBlur={() => commit({ ...values, slug: values.slug || slugify(values.name) || "workspace" }, "Address updated")}
              />
            </label>
          </section>
        )}

        {/* What the assistant should know about the company */}
        <header className="ui-sg-head">
          <h2>Company context</h2>
          <p>Added to every chat in this workspace, so the assistant already knows how your company works. Keep it short – it counts toward every message.</p>
        </header>
        {loading ? (
          <SkeletonTextArea label="Loading company context" lines={["92%", "84%", "58%"]}>
            <TextArea
              minRows={6}
              maxRows={14}
              expandable
              maxLength={CONTEXT_MAX}
              counter
              defaultValue=""
              aria-label="Company context"
              hint="Two or three short paragraphs work best: what the company does, how it's organised and the terms people use. Leave out slogans and history."
            />
          </SkeletonTextArea>
        ) : (
          <TextArea
            minRows={6}
            maxRows={14}
            expandable
            expandedRows={16}
            expanded={wide}
            onExpandedChange={setWide}
            maxLength={CONTEXT_MAX}
            counter
            value={values.context}
            placeholder="E.g. We have three business units – Sales, Operations and Finance. Common terms: CRM (customer relationship management), SLA (service level agreement). Regional leads escalate to the COO."
            aria-label="Company context"
            hint={
              (values.context.length > 0 ? `About ${tokens} tokens per message. ` : "") +
              "Two or three short paragraphs work best: what the company does, how it's organised and the terms people use. Leave out slogans and history."
            }
            onChange={(e) => set("context", e.target.value)}
            onBlur={() => commit(values, "Context saved")}
          />
        )}

        {/* Danger zone */}
        <header className="ui-sg-head">
          <h2>Danger zone</h2>
        </header>
        <section className="ui-sg-card ui-sg-card--danger" aria-label="Danger zone">
          <div className="ui-sg-row">
            <span className="ui-sg-label">
              <b>Delete workspace</b>
              <small>{loading ? <SkeletonLine width={300} bar={8} /> : `All chats, files and agents of ${saved.current.name} go for good, for every member.`}</small>
            </span>
            {!deleting && (
              <button ref={deleteBtn} type="button" className="ui-sg-danger" disabled={loading} onClick={() => setDeleting(true)}>
                <Icon icon={Delete02Icon} size={15} />
                Delete workspace
              </button>
            )}
          </div>
          {/* Confirm by typing the name – the button wakes up once it matches */}
          {deleting && (
            <form
              className="ui-sg-confirm"
              onKeyDown={(e) => e.key === "Escape" && closeDelete()}
              onSubmit={(e) => {
                e.preventDefault();
                if (!canDelete) return;
                onDelete?.();
                showToast(`${saved.current.name} deleted`);
                closeDelete();
              }}
            >
              <label>
                <span>
                  Type <b>{saved.current.name}</b> to confirm
                </span>
                <TextField className="ui-sg-field" value={confirm} autoFocus autoComplete="off" spellCheck={false} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              <span className="ui-sg-control">
                <Button size="sm" variant="secondary" type="button" onClick={closeDelete}>
                  Cancel
                </Button>
                <button type="submit" className="ui-sg-danger ui-sg-danger--solid" disabled={!canDelete}>
                  Delete for good
                </button>
              </span>
            </form>
          )}
        </section>
      </div>
      {toast}
    </AppShell>
  );
}

/* ---------- Styles ---------- */

/** Shared with Settings / Security, which builds on these rows */
export const css = /* css */ `
/* Settings / General – rows in cards like Settings / Profile, the company context as a field of its own */
.ui-sg { max-width: 760px; margin: 0 auto; }

.ui-sg-head { margin-top: 36px; }
.ui-sg-head h2 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; color: var(--strong); }
.ui-sg-head p { max-width: 620px; margin: 2px 0 0; font-size: 13px; line-height: 20px; color: var(--muted); }

.ui-sg-card { position: relative; margin-top: 12px; border-radius: calc(var(--aui-radius-lg, 10px) + 2px); background: var(--card); box-shadow: var(--card-shadow); }
.ui-as-page-sub + .ui-sg-card { margin-top: 24px; }

.ui-sg-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 60px; padding: 10px 12px 10px 16px; }
.ui-sg-row + .ui-sg-row { box-shadow: inset 0 0.5px 0 var(--line); }
.ui-sg-label { display: grid; min-width: 0; }
.ui-sg-label b { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--strong); }
.ui-sg-label small { font-size: 12px; line-height: 16px; color: var(--muted); }
/* Long names, addresses and links wrap instead of pushing the control out */
.ui-sg-label b, .ui-sg-label small { overflow-wrap: anywhere; }
/* Buttons never squeeze into an ellipsis next to a long label */
.ui-sg-row > :is(button, .ui-buttonc, .ui-as-anchor), .ui-sg-control > :is(button, .ui-buttonc) { flex: none; }
.ui-sg-control { display: flex; flex: none; align-items: center; gap: 8px; min-width: 0; }

/* Fields: the library's Text Field at a fixed width – 32px, a hairline that only firms up on focus (no ring) */
.ui-sg-field { flex: none; width: 260px; }

/* The icon: the first letter until there is a picture; a small × to remove it */
.ui-sg-icon { position: relative; display: grid; flex: none; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--logo-bg, #fff); box-shadow: inset 0 0 0 0.5px var(--line-strong), 0 1px 2px rgba(0, 0, 0, 0.06); font-size: 14px; font-weight: 500; color: var(--ink); }
.ui-sg-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.ui-sg-icon__remove { position: absolute; top: -4px; right: -4px; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--card); box-shadow: var(--card-shadow); color: var(--muted); }
.ui-sg-icon__remove:hover { color: var(--ink); }
/* A 32px target around the small × */
.ui-sg-icon__remove::before { content: ""; position: absolute; inset: -7px; }
.ui-sg-icon__remove:focus-visible { outline: 2px solid var(--ui-as-focus); outline-offset: 2px; box-shadow: var(--card-shadow); color: var(--ink); }

/* Company context: a calm writing field; a count and a button to give it more room */

/* Danger zone: the same card, the action in red; confirming asks for the name */
.ui-sg-danger { display: inline-flex; flex: none; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 10px; border-radius: calc(var(--aui-radius, 7px) + 1px); box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--aui-red, #f04438) 35%, transparent); font-size: 13px; font-weight: 500; color: var(--aui-red, #f04438); transition: background-color 140ms ease, opacity 140ms ease; }
.ui-sg-danger:hover { background: color-mix(in srgb, var(--aui-red, #f04438) 6%, transparent); }
.ui-sg-danger:focus-visible { outline: 2px solid var(--ui-as-focus); outline-offset: 2px; box-shadow: inset 0 0 0 0.5px rgba(220, 38, 38, 0.35); }
.ui-sg-danger--solid { padding: 0 12px; background: var(--aui-red, #f04438); box-shadow: none; color: #fff; }
.ui-sg-danger--solid:hover { background: var(--aui-danger, #c4320a); }
.ui-sg-danger:disabled { opacity: 0.4; cursor: default; }
.ui-sg-danger--solid:disabled:hover { background: var(--aui-red, #f04438); }
.ui-sg-confirm { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 12px 12px 14px 16px; box-shadow: inset 0 0.5px 0 var(--line); animation: ui-as-rise 260ms var(--ease) both; }
.ui-sg-confirm label { display: grid; gap: 6px; font-size: 12.5px; color: var(--muted); }
.ui-sg-confirm b { font-weight: 500; color: var(--ink); }
:where(.dark, [data-theme="dark"]) .ui-sg-danger:not(.ui-sg-danger--solid) { color: var(--aui-red, #ff6b5f); }

/* A list that lost its last focusable row takes the focus itself – ringed like a field */
.ui-sg-card[tabindex="-1"]:focus-visible { outline: 2px solid var(--ui-as-focus); outline-offset: 2px; box-shadow: var(--card-shadow); }

/* Narrow: each control goes under its label, full width */
@container ui-as-main (max-width: 600px) {
  .ui-sg-row, .ui-sg-confirm { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 14px; }
  .ui-sg-field { width: 100%; }
  .ui-sg-danger { justify-content: center; }
  .ui-sg-confirm .ui-sg-control > * { flex: 1; justify-content: center; }
}
`;
