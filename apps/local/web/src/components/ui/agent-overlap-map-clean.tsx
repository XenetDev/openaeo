// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Agent Overlap Map – where the work of people's AI agents collides, in a single self-contained file.
 *   · every agent is a small chip with its own pixel mark and whose agent it is, on the left and the right
 *   · every open conflict is a badge in the middle, a curve runs into it from each agent it involves
 *   · red needs a decision, amber is a heads-up, a grey dashed curve is minor
 *   · point at a conflict or an agent and what belongs to it stays while the rest fades back, its agents' marks twinkle
 *   · click an agent or a conflict and a card opens below it – who and what, and everything it's tangled up in
 *   · people whose agents collide with no one are listed as in sync below
 * The styles are injected below, so no extra files are needed.
 */

export type OverlapPerson = {
  id: string;
  name: string;
  /** A short line for the tooltip – what they're working on */
  note?: string;
};

export type OverlapSide = {
  personId: string;
  /** The agent's name – "Codex", "Claude Code", "Review bot" */
  agentName: string;
  /** The agent's tool – its company's logo shows next to the name; a key into harnesses */
  harness?: string;
};

export type OverlapConflict = {
  id: string;
  /** Short badge text – "Contradicts", "Same files" */
  label: string;
  /** The full sentence – the tooltip and the accessible name */
  title: string;
  severity: "high" | "medium" | "low";
  sides: OverlapSide[];
};

export type OverlapHarness = { name?: string; logo?: ReactNode };

export type AgentOverlapMapProps = {
  people: OverlapPerson[];
  conflicts: OverlapConflict[];
  /** A logo per harness key – the model company's mark next to the agent's name */
  harnesses?: Record<string, OverlapHarness>;
  /** Controlled selection – leave out to let the map keep its own; null clears it */
  selectedPersonId?: string | null;
  selectedConflictId?: string | null;
  highlightedConflictId?: string | null;
  onSelectPerson?: (id: string | null) => void;
  onSelectConflict?: (id: string | null) => void;
  onHighlightConflict?: (id: string | null) => void;
  /** Smallest height of the map area in px – it grows with the number of agents and conflicts */
  height?: number;
  title?: string;
  className?: string;
};

/* ---------- Helpers ---------- */

const first = (name: string) => name.trim().split(/\s+/).find((w) => /\p{L}/u.test(w)) || name.trim() || name;
const SEVERITY = { high: "Needs a decision", medium: "Heads-up", low: "Minor" } as const;
const list = (names: string[]) => {
  try {
    return new Intl.ListFormat("en", { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
};

/* The agents' colors – the first is the library's blue */
const COLORS = ["var(--ui-aomc-agent)", "rgba(166, 81, 240, 0.85)", "rgba(20, 179, 240, 0.8)", "rgba(242, 138, 46, 0.82)", "rgba(95, 200, 138, 0.8)", "rgba(238, 62, 158, 0.78)"];
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

/* An agent's mark: its own pixel pattern in its color – it twinkles while the agent is busy; a person is the full mark in ink */
function Mark({ id, busy, full }: { id: string; busy?: boolean; full?: boolean }) {
  const cells = full ? [1, 1, 1, 1, 1, 1, 1, 1, 1] : pattern(id);
  return (
    <span className="ui-aomc__mark" data-busy={busy ? "" : undefined} data-full={full ? "" : undefined} aria-hidden="true">
      {cells.map((on, i) => (
        <i key={i} data-on={on ? "" : undefined} style={{ animationDelay: `${WAVE[i]}ms` }} />
      ))}
    </span>
  );
}

type Agent = { key: string; personId: string; agentName: string; harness?: string; conflicts: string[]; color: string };
type Placed = { a: Agent; x: number; y: number; side: "left" | "right" };
type Badge = { c: OverlapConflict; x: number; y: number };

const NODE_PITCH = 44;
const BADGE_PITCH = 40;
const PAD = 14;

/* ---------- The map ---------- */

export function AgentOverlapMap({
  people,
  conflicts,
  harnesses = {},
  selectedPersonId,
  selectedConflictId,
  highlightedConflictId,
  onSelectPerson,
  onSelectConflict,
  onHighlightConflict,
  height = 0,
  title = "Agent overlaps",
  className,
}: AgentOverlapMapProps) {
  // Controlled when the prop is given, otherwise the map keeps its own
  const [ownPerson, setOwnPerson] = useState<string | null>(null);
  const [ownConflict, setOwnConflict] = useState<string | null>(null);
  const [ownHighlight, setOwnHighlight] = useState<string | null>(null);
  const person = selectedPersonId !== undefined ? selectedPersonId : ownPerson;
  const picked = selectedConflictId !== undefined ? selectedConflictId : ownConflict;
  const lit = highlightedConflictId !== undefined ? highlightedConflictId : ownHighlight;
  const pickPerson = (id: string | null) => {
    setOwnPerson(id);
    onSelectPerson?.(id);
  };
  const pickConflict = (id: string | null) => {
    setOwnConflict(id);
    onSelectConflict?.(id);
  };
  const light = (id: string | null) => {
    setOwnHighlight(id);
    onHighlightConflict?.(id);
  };
  // Pointing at an agent lights all of its conflicts – only inside the map
  const [hoverAgent, setHoverAgent] = useState<string | null>(null);

  // The map's width – everything is placed from it
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  // Only conflicts whose agents are on the map, each agent once per conflict
  const shown = useMemo(
    () =>
      conflicts
        .map((c) => ({
          ...c,
          sides: c.sides.filter(
            (s, i, all) => byId.has(s.personId) && all.findIndex((o) => o.personId === s.personId && o.agentName === s.agentName) === i,
          ),
        }))
        .filter((c) => c.sides.length > 0),
    [conflicts, byId],
  );

  // Every agent once – a person working with two agents shows twice
  const agents = useMemo(() => {
    const m = new Map<string, Agent>();
    shown.forEach((c) =>
      c.sides.forEach((s) => {
        const key = `${s.personId}\u0000${s.agentName}`;
        const a = m.get(key) ?? { key, personId: s.personId, agentName: s.agentName, harness: s.harness, conflicts: [], color: COLORS[m.size % COLORS.length] };
        a.conflicts.push(c.id);
        m.set(key, a);
      }),
    );
    return [...m.values()];
  }, [shown]);
  const agentOf = (s: OverlapSide) => agents.find((a) => a.personId === s.personId && a.agentName === s.agentName)!;

  const wide = w >= 560;
  const layout = useMemo(() => {
    if (!w || !agents.length) return null;
    // Order: whoever shares the most with the last one comes next – then alternate sides, so partners face each other
    const shared = (a: Agent, b: Agent) => a.conflicts.filter((id) => b.conflicts.includes(id)).length;
    const left = [...agents].sort((a, b) => b.conflicts.length - a.conflicts.length);
    const order: Agent[] = [];
    while (left.length) {
      const last = order[order.length - 1];
      let best = 0;
      if (last) left.forEach((a, i) => shared(last, a) > shared(last, left[best]) && (best = i));
      order.push(left.splice(best, 1)[0]);
    }
    let L = wide ? order.filter((_, i) => i % 2 === 0) : order;
    let R = wide ? order.filter((_, i) => i % 2 === 1) : [];
    let C = [...shown];
    // A few rounds of sorting by the average place on the other side – fewer crossings
    const rank = (n: number, i: number) => (n > 1 ? i / (n - 1) : 0.5);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0.5);
    const where = (a: Agent) => (L.includes(a) ? rank(L.length, L.indexOf(a)) : rank(R.length, R.indexOf(a)));
    const ofC = (c: OverlapConflict) => mean(c.sides.map((s) => where(agentOf(s))));
    const ofA = (a: Agent) => mean(a.conflicts.map((id) => rank(C.length, C.findIndex((c) => c.id === id))));
    for (let n = 0; n < 4; n++) {
      C = [...C].sort((p, q) => ofC(p) - ofC(q));
      L = [...L].sort((p, q) => ofA(p) - ofA(q));
      R = [...R].sort((p, q) => ofA(p) - ofA(q));
    }
    const inner = Math.max(L.length * NODE_PITCH, R.length * NODE_PITCH, C.length * BADGE_PITCH);
    const h = Math.max(height, inner + PAD * 2);
    const col = (n: number, pitch: number, i: number) => h / 2 + (i - (n - 1) / 2) * pitch;
    const nodeW = wide ? Math.min(196, w * 0.3) : Math.min(190, w * 0.5);
    const placed: Placed[] = [
      ...L.map((a, i) => ({ a, side: "left" as const, x: 0, y: col(L.length, NODE_PITCH, i) })),
      ...R.map((a, i) => ({ a, side: "right" as const, x: w - nodeW, y: col(R.length, NODE_PITCH, i) })),
    ];
    // Badges in the middle – on a phone lined up on the right edge, the curves end under them
    const badgeX = wide ? w / 2 : w - 24;
    const badges: Badge[] = C.map((c, i) => ({ c, x: badgeX, y: col(C.length, BADGE_PITCH, i) }));
    const badgeMax = wide ? Math.min(180, w - nodeW * 2 - 48) : Math.max(64, w - nodeW - 24);
    return { placed, badges, h, nodeW, badgeMax };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, wide, agents, shown, height]);

  // One info card at a time – an agent's (internal) or the picked conflict's
  const [ownAgent, setOwnAgent] = useState<string | null>(null);
  // A person picked from outside opens their (first) agent's card
  const openAgent =
    ownAgent && (!person || agents.find((a) => a.key === ownAgent)?.personId === person)
      ? ownAgent
      : person
        ? (agents.find((a) => a.personId === person)?.key ?? null)
        : null;
  const openKey = openAgent ? `a:${openAgent}` : picked ? `c:${picked}` : null;
  const close = (refocus: boolean) => {
    const key = openKey;
    if (openAgent) {
      setOwnAgent(null);
      pickPerson(null);
    }
    if (picked) pickConflict(null);
    if (refocus && key) box.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus();
  };
  // Esc closes it and puts focus back; a click anywhere else closes it
  useEffect(() => {
    if (!openKey) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.(".ui-aomc__pop, .ui-aomc__agent, .ui-aomc__badge") || !box.current?.contains(t)) close(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);
  const pop = useRef<HTMLDivElement>(null);
  const [popH, setPopH] = useState(0);
  useLayoutEffect(() => {
    if (pop.current) setPopH(pop.current.offsetHeight);
  }, [openKey, w]);
  const logo = (h?: string) =>
    h && harnesses[h]?.logo ? (
      <span className="ui-aomc__logo" aria-hidden="true">
        {harnesses[h].logo}
      </span>
    ) : null;

  const hovered = agents.find((a) => a.key === hoverAgent);
  const isLit = (id: string) => lit === id || !!hovered?.conflicts.includes(id);
  const anyLit = !!lit || !!hovered;
  const inSync = people.filter((p) => !shown.some((c) => c.sides.some((s) => s.personId === p.id)));

  return (
    <section className={["ui-aomc", className].filter(Boolean).join(" ")} aria-label={title}>
      <style href="ui-agent-overlap-map-clean" precedence="default">
        {css}
      </style>

      <div className="ui-aomc__head">
        <span className="ui-aomc__title">
          <b>{title}</b>
          {shown.length ? <span className="ui-aomc__count">{shown.length}</span> : null}
        </span>
        {shown.length ? (
        <ul className="ui-aomc__legend" aria-label="Severity">
          {(["high", "medium", "low"] as const).map((s) => (
            <li key={s}>
              <i className="ui-aomc__dot" data-severity={s} aria-hidden="true" />
              {SEVERITY[s]}
            </li>
          ))}
        </ul>
        ) : null}
      </div>

      <div ref={box} className="ui-aomc__map" data-narrow={w && !wide ? "" : undefined} style={{ height: shown.length ? layout?.h ?? Math.max(height, 160) : undefined }} data-lit={anyLit ? "" : undefined}>
        {layout ? (
          <>
            {/* The curves, from each agent into its conflicts */}
            <svg className="ui-aomc__lines" width={w} height={layout.h} viewBox={`0 0 ${w} ${layout.h}`} aria-hidden="true">
              {layout.badges.map((b) =>
                b.c.sides.map((s) => {
                  const p = layout.placed.find((o) => o.a.personId === s.personId && o.a.agentName === s.agentName)!;
                  const x0 = p.side === "left" ? p.x + layout.nodeW : p.x;
                  const k = (b.x - x0) * 0.55;
                  return (
                    <path
                      key={`${b.c.id}-${p.a.key}`}
                      d={`M${x0} ${p.y} C${x0 + k} ${p.y} ${b.x - k} ${b.y} ${b.x} ${b.y}`}
                      pathLength={b.c.severity === "low" ? undefined : 1}
                      className="ui-aomc__line"
                      data-severity={b.c.severity}
                      data-lit={isLit(b.c.id) ? "" : undefined}
                    />
                  );
                }),
              )}
            </svg>

            {/* The agents */}
            {layout.placed.map(({ a, x, y, side }, i) => {
              const who = byId.get(a.personId)!;
              const on = openAgent === a.key;
              const busy = lit ? a.conflicts.includes(lit) : hoverAgent === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  className="ui-aomc__agent"
                  style={{ left: x, top: y, width: layout.nodeW, "--ui-aomc-m": a.color, animationDelay: `${i * 40}ms` } as CSSProperties}
                  data-key={`a:${a.key}`}
                  data-side={side}
                  data-lit={busy ? "" : undefined}
                  data-near={a.conflicts.some(isLit) ? "" : undefined}
                  aria-expanded={on}
                  aria-label={`${who.name}’s ${a.agentName}, ${a.conflicts.length} ${a.conflicts.length === 1 ? "overlap" : "overlaps"}`}
                  onClick={() => {
                    if (picked) pickConflict(null);
                    setOwnAgent(on ? null : a.key);
                    pickPerson(on ? null : a.personId);
                  }}
                  onPointerEnter={() => setHoverAgent(a.key)}
                  onPointerLeave={() => setHoverAgent(null)}
                  onFocus={() => setHoverAgent(a.key)}
                  onBlur={() => setHoverAgent(null)}
                >
                  <Mark id={a.key} busy={busy} />
                  <span className="ui-aomc__who" dir="auto">
                    {first(who.name)}
                  </span>
                  <span className="ui-aomc__tool">
                    {logo(a.harness)}
                    <span dir="auto">{a.agentName}</span>
                  </span>
                </button>
              );
            })}

            {/* The conflicts */}
            {layout.badges.map((b, i) => {
              const on = picked === b.c.id;
              return (
                <button
                  key={b.c.id}
                  type="button"
                  className="ui-aomc__badge"
                  style={{ left: wide ? b.x : undefined, right: wide ? undefined : 0, top: b.y, maxWidth: layout.badgeMax, animationDelay: `${160 + i * 50}ms` }}
                  data-end={wide ? undefined : ""}
                  data-severity={b.c.severity}
                  data-key={`c:${b.c.id}`}
                  data-lit={isLit(b.c.id) ? "" : undefined}
                  aria-expanded={on}
                  aria-label={`${b.c.label} – ${b.c.title}`}
                  onClick={() => {
                    if (openAgent) {
                      setOwnAgent(null);
                      pickPerson(null);
                    }
                    pickConflict(on ? null : b.c.id);
                  }}
                  onPointerEnter={() => light(b.c.id)}
                  onPointerLeave={() => light(null)}
                  onFocus={() => light(b.c.id)}
                  onBlur={() => light(null)}
                >
                  <span dir="auto">{b.c.label}</span>
                </button>
              );
            })}

            {/* The info card of whatever is open */}
            {(() => {
              const cw = Math.min(272, w);
              const at = (x: number, y: number, below: number) => {
                // Below if it fits in the map and its footer, otherwise above if that fits under the header, otherwise where there's more room
                const fitsBelow = y + below + popH <= layout.h + 40;
                const fitsAbove = y - below - popH >= -34;
                const up = !fitsBelow && (fitsAbove || y > layout.h / 2);
                return { left: Math.min(w - cw, Math.max(0, x)), top: up ? y - below : y + below, width: cw, up };
              };
              const agent = openAgent ? layout.placed.find((o) => o.a.key === openAgent) : undefined;
              if (agent) {
                const who = byId.get(agent.a.personId)!;
                const pos = at(agent.side === "left" ? agent.x : agent.x + layout.nodeW - cw, agent.y, 22);
                const mine = shown.filter((c) => agent.a.conflicts.includes(c.id));
                return (
                  <div ref={pop} key={openKey} className="ui-aomc__pop" style={{ left: pos.left, top: pos.top, width: pos.width }} data-up={pos.up ? "" : undefined} role="group" aria-label={`${who.name}’s ${agent.a.agentName}`}>
                    <div className="ui-aomc__pop-head" style={{ "--ui-aomc-m": agent.a.color } as CSSProperties}>
                      <Mark id={agent.a.key} />
                      <span className="ui-aomc__pop-name">
                        <b dir="auto">{who.name}</b>
                        <span className="ui-aomc__tool">
                          {logo(agent.a.harness)}
                          <span dir="auto">{agent.a.agentName}</span>
                        </span>
                      </span>
                    </div>
                    {who.note ? <p className="ui-aomc__pop-text" dir="auto">{who.note}</p> : null}
                    <ul className="ui-aomc__pop-list" aria-label="Overlaps">
                      {mine.map((c) => (
                        <li key={c.id}>
                          <span className="ui-aomc__chip" data-severity={c.severity}>
                            {c.label}
                          </span>
                          <span dir="auto">{c.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              const badge = picked ? layout.badges.find((o) => o.c.id === picked) : undefined;
              if (badge) {
                const pos = at(wide ? badge.x - cw / 2 : w - cw, badge.y, 17);
                return (
                  <div ref={pop} key={openKey} className="ui-aomc__pop" style={{ left: pos.left, top: pos.top, width: pos.width }} data-up={pos.up ? "" : undefined} role="group" aria-label={badge.c.label}>
                    <div className="ui-aomc__pop-head">
                      <span className="ui-aomc__chip" data-severity={badge.c.severity}>
                        {badge.c.label}
                      </span>
                      <span className="ui-aomc__pop-sev">{SEVERITY[badge.c.severity]}</span>
                    </div>
                    <p className="ui-aomc__pop-text ui-aomc__pop-text--ink" dir="auto">
                      {badge.c.title}
                    </p>
                    <ul className="ui-aomc__pop-list ui-aomc__pop-list--agents" aria-label="Agents">
                      {badge.c.sides.map((sd) => {
                        const a = agentOf(sd);
                        const who = byId.get(sd.personId)!;
                        return (
                          <li key={a.key} style={{ "--ui-aomc-m": a.color } as CSSProperties}>
                            <Mark id={a.key} />
                            <b dir="auto">{first(who.name)}</b>
                            <span className="ui-aomc__tool">
                              {logo(a.harness)}
                              <span dir="auto">{a.agentName}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}
          </>
        ) : null}
        {!shown.length ? <p className="ui-aomc__empty">No overlaps right now – everyone’s agents are in sync.</p> : null}
      </div>

      {/* Whoever collides with no one */}
      {shown.length && inSync.length ? (
        <p className="ui-aomc__sync">
          <Mark id="person" full />
          <span>
            {inSync.length > 3 ? `${list(inSync.slice(0, 2).map((p) => first(p.name)))} and ${inSync.length - 2} more` : list(inSync.map((p) => first(p.name)))}{" "}
            {inSync.length === 1 ? "is" : "are"} in sync
          </span>
        </p>
      ) : null}
    </section>
  );
}

export default AgentOverlapMap;

/* ---------- Styles ---------- */

const css = /* css */ `
/* Colors as variables – override them on .ui-aomc */
.ui-aomc {
  --ui-aomc-card: var(--aui-surface, #ffffff);
  --ui-aomc-strong: var(--aui-ink, #000000);
  --ui-aomc-ink: var(--aui-ink, rgba(0, 0, 0, 0.88));
  --ui-aomc-text: var(--aui-muted, rgba(0, 0, 0, 0.61));
  --ui-aomc-muted: var(--aui-muted, rgba(0, 0, 0, 0.45));
  --ui-aomc-line: var(--aui-border, rgba(0, 0, 0, 0.06));
  --ui-aomc-fill: rgba(0, 0, 0, 0.04);
  --ui-aomc-agent: rgba(0, 96, 226, 0.78);
  /* Severity: the curve, the badge's text and its tint */
  --ui-aomc-high: #e5484d;
  --ui-aomc-high-fg: #d72400da;
  --ui-aomc-high-bg: #f52b0018;
  --ui-aomc-medium: #e8a200;
  --ui-aomc-medium-fg: var(--aui-warning, #b25e00);
  --ui-aomc-medium-bg: #ff9c0029;
  --ui-aomc-low: rgba(0, 0, 0, 0.3);
  --ui-aomc-low-fg: rgba(0, 0, 0, 0.61);
  --ui-aomc-low-bg: rgba(0, 0, 0, 0.05);
  --ui-aomc-focus: rgba(0, 96, 226, 0.7);
  --ui-aomc-pop: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.06), 0 14px 32px -8px rgba(0, 0, 0, 0.18);
  --ui-aomc-shadow: 0 0 0 0.5px var(--aui-border, rgba(0, 0, 0, 0.06)), 0 1px 1px -1px rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --ui-aomc-shadow-on: 0 0 0 0.5px rgba(0, 0, 0, 0.14), 0 1px 1px -1px rgba(0, 0, 0, 0.12), 0 2px 4px 0 rgba(0, 0, 0, 0.06);
  --ui-aomc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);
  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 16px 18px 14px;
  border-radius: calc(var(--aui-radius-lg, 10px) + 4px);
  background: var(--aui-surface, var(--ui-aomc-card));
  box-shadow: var(--aui-shadow-card, var(--ui-aomc-shadow));
  font-family: var(--aui-font, "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.15px;
  color: var(--ui-aomc-text);
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
.ui-aomc *, .ui-aomc *::before, .ui-aomc *::after { box-sizing: border-box; }
.ui-aomc b { font-weight: 500; color: var(--ui-aomc-strong); }
.ui-aomc button { font: inherit; letter-spacing: inherit; }

/* The header: title, how many, and the legend */
.ui-aomc__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; min-width: 0; }
.ui-aomc__title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.ui-aomc__title > b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-aomc__count { flex: none; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 4px; background: var(--ui-aomc-fill); font-size: 11px; font-weight: 500; line-height: 18px; color: var(--ui-aomc-text); text-align: center; font-variant-numeric: tabular-nums; }
.ui-aomc__legend { display: flex; flex-wrap: wrap; gap: 2px 12px; margin: 0; padding: 0; list-style: none; font-size: 12px; line-height: 16px; color: var(--ui-aomc-muted); }
.ui-aomc__legend > li { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.ui-aomc__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--ui-aomc-c); }
.ui-aomc [data-severity="high"] { --ui-aomc-c: var(--ui-aomc-high); --ui-aomc-fg: var(--ui-aomc-high-fg); --ui-aomc-bg: var(--ui-aomc-high-bg); }
.ui-aomc [data-severity="medium"] { --ui-aomc-c: var(--ui-aomc-medium); --ui-aomc-fg: var(--ui-aomc-medium-fg); --ui-aomc-bg: var(--ui-aomc-medium-bg); }
.ui-aomc [data-severity="low"] { --ui-aomc-c: var(--ui-aomc-low); --ui-aomc-fg: var(--ui-aomc-low-fg); --ui-aomc-bg: var(--ui-aomc-low-bg); }

/* The map */
.ui-aomc__map { position: relative; min-width: 0; }
.ui-aomc__lines { position: absolute; inset: 0; overflow: visible; }
.ui-aomc__line { fill: none; stroke: color-mix(in srgb, var(--ui-aomc-c) 32%, transparent); stroke-width: 1.25; stroke-linecap: round; transition: stroke 280ms ease, opacity 280ms ease; }
.ui-aomc__line[pathLength] { stroke-dasharray: 1; animation: ui-aomc-draw 720ms var(--ui-aomc-ease) 120ms backwards; }
.ui-aomc__line[data-severity="low"] { stroke-dasharray: 3 4; animation: ui-aomc-fade 480ms ease 200ms backwards; }
.ui-aomc__line[data-lit] { stroke: var(--ui-aomc-c); }

/* An agent: its mark, whose it is, and its name */
.ui-aomc__agent { position: absolute; z-index: 1; display: flex; align-items: center; gap: 8px; height: 32px; margin: 0; padding: 0 10px 0 8px; border: 0; border-radius: 8px; background: var(--ui-aomc-card); box-shadow: var(--ui-aomc-shadow); color: var(--ui-aomc-ink); font-size: 13px; line-height: 20px; white-space: nowrap; cursor: pointer; transform: translateY(-50%); transition: box-shadow 200ms ease, background-color 200ms ease, opacity 280ms ease; animation: ui-aomc-fade 360ms ease backwards; -webkit-tap-highlight-color: transparent; }
.ui-aomc__agent:hover, .ui-aomc__agent[data-lit] { box-shadow: var(--ui-aomc-shadow-on); }
.ui-aomc__agent[aria-expanded="true"] { background: color-mix(in srgb, var(--ui-aomc-ink) 4%, var(--ui-aomc-card)); }
.ui-aomc__agent:focus-visible { outline: 2px solid var(--ui-aomc-focus); outline-offset: 2px; }
.ui-aomc__who { flex: none; max-width: 50%; overflow: hidden; font-weight: 500; text-overflow: ellipsis; }
.ui-aomc__tool { display: flex; align-items: center; gap: 5px; min-width: 0; color: var(--ui-aomc-muted); }
.ui-aomc__tool > span[dir] { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* On a phone an agent shows its person and its logo – the agent's name is in its card */
.ui-aomc__map[data-narrow] .ui-aomc__agent .ui-aomc__tool > span[dir] { display: none; }
.ui-aomc__map[data-narrow] .ui-aomc__who { max-width: none; flex: 0 1 auto; min-width: 0; }
.ui-aomc__map[data-narrow] .ui-aomc__agent .ui-aomc__tool:has(.ui-aomc__logo) { flex: none; margin-left: auto; }
.ui-aomc__logo { display: grid; flex: none; place-items: center; width: 14px; height: 14px; }
.ui-aomc__logo > svg, .ui-aomc__logo > img { display: block; width: 14px; height: 14px; }

/* The pixel mark */
.ui-aomc__mark { --ui-aomc-mc: var(--ui-aomc-m, var(--ui-aomc-agent)); display: grid; flex: none; grid-template-columns: repeat(3, 3px); grid-auto-rows: 3px; gap: 1.5px; place-content: center; width: 16px; height: 16px; }
.ui-aomc__mark i { border-radius: 0.75px; background: var(--ui-aomc-mc); opacity: 0; transition: opacity 240ms ease; }
.ui-aomc__mark i[data-on] { opacity: 1; }
.ui-aomc__mark[data-full] i { background: var(--ui-aomc-ink); }
.ui-aomc__mark[data-busy] i { animation: ui-aomc-pixel 1.2s ease-in-out infinite both; }
.ui-aomc__mark[data-busy] i:not([data-on]) { opacity: 0.16; }

/* A conflict: a badge in its severity's color */
.ui-aomc__badge { position: absolute; z-index: 2; display: inline-flex; align-items: center; height: 22px; margin: 0; padding: 0 8px; border: 0; border-radius: calc(var(--aui-radius-sm, 5px) + 1px); background: linear-gradient(var(--ui-aomc-bg), var(--ui-aomc-bg)), var(--ui-aomc-card); color: var(--ui-aomc-fg); font-size: 12px; font-weight: 500; line-height: 16px; white-space: nowrap; cursor: pointer; transform: translate(-50%, -50%); transition: box-shadow 200ms ease, opacity 280ms ease; animation: ui-aomc-in 360ms var(--ui-aomc-ease) backwards; -webkit-tap-highlight-color: transparent; }
/* On a phone: lined up on the right */
.ui-aomc__badge[data-end] { transform: translateY(-50%); transform-origin: right center; animation-name: ui-aomc-in-end; }
.ui-aomc__badge > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* Pointing at a conflict: its badge firms up – a deeper tint and an edge in its color – while everything not in it steps back */
.ui-aomc__badge[data-lit] { --ui-aomc-bg: color-mix(in srgb, var(--ui-aomc-c) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-aomc-c) 60%, transparent); }
.ui-aomc__map[data-lit] .ui-aomc__badge:not([data-lit]), .ui-aomc__map[data-lit] .ui-aomc__agent:not([data-near]) { opacity: 0.4; }
.ui-aomc__badge[aria-expanded="true"] { box-shadow: inset 0 0 0 1px var(--ui-aomc-c); }
.ui-aomc__badge:focus-visible { outline: 2px solid var(--ui-aomc-focus); outline-offset: 2px; }
/* What needs a decision breathes softly */
.ui-aomc__badge[data-severity="high"]::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; animation: ui-aomc-pulse 2.4s ease-in-out infinite; }

.ui-aomc__empty { margin: 0; padding: 28px 12px 18px; font-size: 13px; color: var(--ui-aomc-muted); text-align: center; }
.ui-aomc__sync { display: flex; align-items: center; gap: 8px; min-width: 0; margin: 0; padding-top: 10px; border-top: 0.5px solid var(--ui-aomc-line); font-size: 12px; line-height: 16px; color: var(--ui-aomc-muted); }
.ui-aomc__sync > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-aomc__sync .ui-aomc__mark { opacity: 0.4; }

/* The info card */
.ui-aomc__pop { position: absolute; z-index: 6; display: grid; gap: 8px; padding: 10px 12px 12px; border-radius: 10px; background: var(--ui-aomc-card); box-shadow: var(--ui-aomc-pop); font-size: 12px; line-height: 16px; color: var(--ui-aomc-text); white-space: normal; animation: ui-aomc-pop 200ms var(--ui-aomc-ease) both; }
.ui-aomc__pop[data-up] { transform: translateY(-100%); animation-name: ui-aomc-pop-up; }
.ui-aomc__pop-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ui-aomc__pop-name { display: grid; min-width: 0; font-size: 13px; line-height: 18px; }
.ui-aomc__pop-name > b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-aomc__pop-name .ui-aomc__tool { font-size: 12px; line-height: 16px; }
.ui-aomc__pop-head > .ui-aomc__chip { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ui-aomc__pop-sev { flex: none; margin-left: auto; color: var(--ui-aomc-muted); white-space: nowrap; }
.ui-aomc__pop-text { margin: 0; overflow-wrap: anywhere; }
.ui-aomc__pop-text--ink { font-size: 13px; line-height: 18px; color: var(--ui-aomc-ink); }
.ui-aomc__pop-list { display: grid; gap: 6px; margin: 0; padding: 8px 0 0; border-top: 0.5px solid var(--ui-aomc-line); list-style: none; }
.ui-aomc__pop-list > li { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.ui-aomc__pop-list > li > span[dir] { display: -webkit-box; min-width: 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
.ui-aomc__pop-list--agents > li { align-items: center; font-size: 13px; line-height: 18px; }
.ui-aomc__pop-list--agents > li > b { flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-aomc__pop-list--agents .ui-aomc__tool > span[dir] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-aomc__chip { flex: none; display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 4px; background: var(--ui-aomc-bg); color: var(--ui-aomc-fg); font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; }

@keyframes ui-aomc-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } }
@keyframes ui-aomc-in-end { from { opacity: 0; transform: translateY(-50%) scale(0.9); } }
@keyframes ui-aomc-fade { from { opacity: 0; } }
@keyframes ui-aomc-pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
@keyframes ui-aomc-pop-up { from { opacity: 0; transform: translateY(calc(-100% + 4px)) scale(0.98); } }
@keyframes ui-aomc-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes ui-aomc-pixel { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
@keyframes ui-aomc-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ui-aomc-c) 40%, transparent); } 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ui-aomc-c) 0%, transparent); } }

/* Touch: bigger targets */
@media (pointer: coarse) {
  .ui-aomc__badge { height: 26px; }
}

@media (prefers-reduced-motion: reduce) {
  .ui-aomc *, .ui-aomc *::before, .ui-aomc *::after { animation: none !important; transition: none !important; }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-aomc {
  --ui-aomc-card: var(--aui-surface, #1c1c1e);
  --ui-aomc-strong: var(--aui-ink, #ffffff);
  --ui-aomc-ink: var(--aui-ink, rgba(255, 255, 255, 0.9));
  --ui-aomc-text: var(--aui-muted, rgba(255, 255, 255, 0.62));
  --ui-aomc-muted: var(--aui-muted, rgba(255, 255, 255, 0.46));
  --ui-aomc-line: var(--aui-border, rgba(255, 255, 255, 0.1));
  --ui-aomc-fill: rgba(255, 255, 255, 0.07);
  --ui-aomc-agent: rgba(77, 141, 255, 0.85);
  --ui-aomc-high: #ff6369;
  --ui-aomc-high-fg: #ff8f8a;
  --ui-aomc-high-bg: rgba(255, 90, 80, 0.16);
  --ui-aomc-medium: #e6c24d;
  --ui-aomc-medium-fg: #ffb35c;
  --ui-aomc-medium-bg: rgba(255, 170, 60, 0.16);
  --ui-aomc-low: rgba(255, 255, 255, 0.34);
  --ui-aomc-low-fg: rgba(255, 255, 255, 0.7);
  --ui-aomc-low-bg: rgba(255, 255, 255, 0.08);
  --ui-aomc-focus: rgba(77, 141, 255, 0.8);
  --ui-aomc-pop: 0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.4), 0 14px 32px -8px rgba(0, 0, 0, 0.6);
  --ui-aomc-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.4);
  --ui-aomc-shadow-on: 0 0 0 0.5px rgba(255, 255, 255, 0.2), 0 1px 3px rgba(0, 0, 0, 0.5);
}
`;
