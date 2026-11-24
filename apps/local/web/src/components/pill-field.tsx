import type { IconSvgElement } from "@hugeicons/react";
import { type ComponentPropsWithoutRef, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner-clean";

const LINE = 24;

type Props = {
	icon: IconSvgElement;
	label: string;
	value: string;
	onChange: (value: string) => void;
	onSubmit?: () => void;
	placeholder?: string;
	maxLines?: number;
	disabled?: boolean;
	extra?: ReactNode;
	action: ReactNode;
	fieldRef?: RefObject<HTMLTextAreaElement | null>;
	textareaProps?: Omit<ComponentPropsWithoutRef<"textarea">, "value" | "onChange" | "rows" | "placeholder" | "disabled">;
	className?: string;
	children?: ReactNode;
	"data-open"?: boolean;
};

export function PillField({ icon, label, value, onChange, onSubmit, placeholder, maxLines = 5, disabled, extra, action, fieldRef, textareaProps, className, children, ...rest }: Props) {
	const own = useRef<HTMLTextAreaElement>(null);
	const field = fieldRef ?? own;
	const [multi, setMulti] = useState(false);

	useEffect(() => {
		const el = field.current;
		if (!el) return;
		el.style.height = "auto";
		const full = el.scrollHeight;
		el.style.height = `${Math.min(full, maxLines * LINE)}px`;
		el.style.overflowY = full > maxLines * LINE ? "auto" : "hidden";
		setMulti(full > LINE + 2);
	}, [value, maxLines, field]);

	return (
		<div className={["oa-pill", className].filter(Boolean).join(" ")} data-multi={multi || undefined} {...rest}>
			<div className="oa-pill-row">
				<Icon icon={icon} size={18} />
				<textarea
					ref={field}
					aria-label={label}
					rows={1}
					value={value}
					placeholder={placeholder}
					disabled={disabled}
					spellCheck={false}
					onChange={(e) => onChange(maxLines === 1 ? e.target.value.replace(/\n/g, "") : e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault();
							onSubmit?.();
						}
					}}
					{...textareaProps}
				/>
				{extra}
				{action}
			</div>
			{children}
		</div>
	);
}

export function PillButton({ label, onClick, disabled, loading, kind = "go" }: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean; kind?: "go" | "stop" }) {
	return (
		<button type="button" className="oa-pill-go" data-kind={kind} aria-label={label} title={label} disabled={disabled || loading} aria-busy={loading || undefined} onClick={onClick}>
			{loading ? <Spinner /> : <Icon icon={kind === "stop" ? StopIcon : ArrowUp02Icon} size={18} stroke={2.2} />}
		</button>
	);
}
