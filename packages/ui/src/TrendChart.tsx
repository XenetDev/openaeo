"use client";
import { useState } from "react";
import { when } from "./format";
import type { ReportView } from "./types";

const W = 640;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 26, left: 34 };

export function TrendChart({ trend }: { trend: ReportView["trend"] }) {
	const [hover, setHover] = useState<number | null>(null);
	if (trend.length < 2) {
		return <p className="oa-muted">The trend appears after two runs. Each run adds a point.</p>;
	}
	const innerW = W - PAD.left - PAD.right;
	const innerH = H - PAD.top - PAD.bottom;
	const x = (i: number) => PAD.left + (i / (trend.length - 1)) * innerW;
	const y = (v: number) => PAD.top + (1 - Math.min(100, Math.max(0, v)) / 100) * innerH;
	const path = trend.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.visibility).toFixed(1)}`).join(" ");
	const active = hover === null ? null : trend[hover];
	const last = trend[trend.length - 1];

	return (
		<figure className="oa-chart">
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visibility score for each run, from oldest to newest">
				{[0, 50, 100].map((tick) => (
					<g key={tick}>
						<line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="oa-grid" />
						<text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="oa-axis">
							{tick}
						</text>
					</g>
				))}
				<path d={path} className="oa-line" />
				{trend.map((p, i) => (
					<circle key={p.runId} cx={x(i)} cy={y(p.visibility)} r={hover === i ? 5 : 4} className="oa-dot" />
				))}
				{active && hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="oa-cross" /> : null}
				{last ? (
					<text x={x(trend.length - 1) - 8} y={y(last.visibility) - 10} textAnchor="end" className="oa-point-label">
						{last.visibility}
					</text>
				) : null}
				<text x={PAD.left} y={H - 6} className="oa-axis">
					{trend[0] ? when(trend[0].startedAt) : ""}
				</text>
				<text x={W - PAD.right} y={H - 6} textAnchor="end" className="oa-axis">
					{last ? when(last.startedAt) : ""}
				</text>
				{trend.map((p, i) => (
					<rect
						key={`hit-${p.runId}`}
						x={x(i) - innerW / (trend.length - 1) / 2}
						y={0}
						width={innerW / (trend.length - 1)}
						height={H}
						fill="transparent"
						onMouseEnter={() => setHover(i)}
						onMouseLeave={() => setHover(null)}
					/>
				))}
			</svg>
			<figcaption className="oa-chart-tip" aria-live="polite">
				{active ? `${when(active.startedAt)} · visibility ${active.visibility} · mentioned in ${Math.round(active.mentionRate * 100)}% of answers` : "Hover a point for its run."}
			</figcaption>
			<details className="oa-details">
				<summary>Show as a table</summary>
				<table className="oa-table">
					<thead>
						<tr>
							<th>Run</th>
							<th>Visibility</th>
							<th>Mentioned</th>
						</tr>
					</thead>
					<tbody>
						{trend.map((p) => (
							<tr key={p.runId}>
								<td>{when(p.startedAt)}</td>
								<td>{p.visibility}</td>
								<td>{Math.round(p.mentionRate * 100)}%</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</figure>
	);
}
