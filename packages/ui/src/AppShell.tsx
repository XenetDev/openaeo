"use client";
import type { ReactNode } from "react";
import type { PageId, ProjectView } from "./types";

const PAGES: { id: PageId; label: string }[] = [
	{ id: "overview", label: "Overview" },
	{ id: "prompts", label: "Prompts" },
	{ id: "answers", label: "Answers" },
	{ id: "sources", label: "Sources" },
	{ id: "competitors", label: "Competitors" },
	{ id: "audit", label: "Audit" },
	{ id: "settings", label: "Settings" },
];

export type AppShellProps = {
	projects: ProjectView[];
	project: ProjectView;
	page: PageId;
	onNavigate: (page: PageId) => void;
	onSelectProject: (id: string) => void;
	onNewProject: () => void;
	children: ReactNode;
};

export function AppShell({ projects, project, page, onNavigate, onSelectProject, onNewProject, children }: AppShellProps) {
	return (
		<div className="oa-shell">
			<aside className="oa-side">
				<div className="oa-brand">
					<span className="oa-brand-mark" aria-hidden="true" />
					OpenAEO
				</div>
				<label className="oa-label" htmlFor="oa-project">
					Brand
				</label>
				<select id="oa-project" className="oa-select" value={project.id} onChange={(e) => onSelectProject(e.target.value)}>
					{projects.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
				<nav className="oa-nav" aria-label="Pages">
					{PAGES.map((item, index) => (
						<button
							key={item.id}
							type="button"
							aria-current={item.id === page ? "page" : undefined}
							className="oa-nav-item"
							onClick={() => onNavigate(item.id)}
						>
							<span className="oa-nav-index" aria-hidden="true">
								{String(index + 1).padStart(2, "0")}
							</span>
							{item.label}
						</button>
					))}
				</nav>
				<button type="button" className="oa-link oa-side-foot" onClick={onNewProject}>
					+ Track another brand
				</button>
			</aside>
			<main className="oa-main">{children}</main>
		</div>
	);
}
