// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
import type { IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Icon } from "@/components/app-shell";

export type StartChip = { label: string; icon: IconSvgElement; onSelect: () => void };

export function AssistantStart({ title, composer, chips, note }: { title: string; composer: ReactNode; chips: StartChip[]; note?: ReactNode }) {
  return (
    <section className="ui-as-start">
      <style href="ui-screen-assistant-start" precedence="default">
        {css}
      </style>
      <h1 className="ui-as-start__title">{title}</h1>
      <div className="ui-as-start__composer">{composer}</div>
      {chips.length > 0 && (
        <div className="ui-as-chips">
          <div className="ui-as-chips__row">
            {chips.map((chip) => (
              <button key={chip.label} type="button" className="ui-as-chip" onClick={chip.onSelect}>
                <Icon icon={chip.icon} size={15} />
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {note}
    </section>
  );
}

const css = /* css */ `
.ui-as-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: min(672px, calc(100% - 48px));
  /* Fills the main area, so heading, composer and suggestions sit in its exact vertical middle */
  flex: 1;
  margin: 0 auto;
  padding: 64px 0;
}

.ui-as-start__title {
  margin: 0;
  font-size: 28px;
  line-height: 34px;
  font-weight: 500;
  letter-spacing: -0.025em;
  color: var(--ink);
  text-align: center;
  text-wrap: balance;
}

.ui-as-start__composer { width: 100%; margin-top: 30px; }
.ui-as-start__composer > .ui-ccc { max-width: none; }
.ui-as-start__title, .ui-as-chips, .ui-as-start__below { transition: opacity 180ms ease, transform 180ms ease; }
.ui-as-start { container: ui-start / inline-size; }
.ui-as-chips { display: grid; gap: 7px; margin-top: 18px; }
.ui-as-chips__row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ui-as-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  height: 32px;
  padding: 0 12px 0 11px;
  border-radius: 16px;
  /* No fill and no outline – a soft tint only on hover */
  font-size: 12px;
  color: var(--text);
  transition: background-color 140ms ease, color 140ms ease;
}
.ui-as-chip svg { flex: none; color: var(--text); }
.ui-as-chip span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ui-as-chip:hover { background: var(--hover); color: var(--ink); }
.ui-as-chip { margin: 0; border: 0; background: none; font-family: inherit; cursor: pointer; }
`;
