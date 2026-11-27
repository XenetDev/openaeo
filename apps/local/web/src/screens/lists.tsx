import type { CompetitorIdea, EngineView, EntityView, ProjectView, ReportView } from "@api";
import { Add01Icon, Delete02Icon, News01Icon, SparklesIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { type ReactNode, useState } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { DataTable } from "@/components/ui/data-table-clean";
import { Dialog } from "@/components/ui/dialog-clean";
import { Spinner } from "@/components/ui/spinner-clean";
import { TagInput } from "@/components/ui/tag-input-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { SuggestMark } from "./command-icons";
import { CompetitorInsight } from "./competitor-insight";
import { Page } from "./shared";

export function SourcesScreen({
	project,
	report,
	filter,
}: {
	project: ProjectView;
	report: ReportView;
	filter?: ReactNode;
}) {
	return (
		<Page brand={project.name} title="Sources" actions={filter}>
			{report.topDomains.length === 0 ? (
				<EmptyState
					icon={News01Icon}
					title="No sources yet"
					text="After a run, this lists the sites the engines linked to in their answers. These are the places worth being mentioned on."
				/>
			) : (
				<DataTable
					title="Sites cited in the latest answers"
					editable={false}
					columns={[
						{ key: "site", label: "Site", type: "title" },
						{ key: "citations", label: "Citations", type: "number", width: "120px" },
						{ key: "owner", label: "Whose", type: "tag", width: "140px" },
						{ key: "link", label: "Open", type: "link" },
					]}
					rows={report.topDomains.map((d) => ({
						id: d.domain,
						logo: <Avatar name={d.domain} size={20} shape="square" />,
						site: d.domain,
						citations: d.citations,
						owner: d.isBrand ? "Yours" : "Other",
						link: `https://${d.domain}`,
					}))}
					tagTones={{ Yours: "green", Other: "gray" }}
				/>
			)}
		</Page>
	);
}

type CompetitorsProps = {
	engines: EngineView[];
	filter?: ReactNode;
	project: ProjectView;
	report: ReportView;
	competitors: EntityView[];
	onSave: (next: EntityView[]) => void;
	ideas: CompetitorIdea[] | null;
	finding: boolean;
	canFind: boolean;
	onFind: () => void;
	onDismissIdeas: () => void;
};

export function CompetitorsScreen({
	engines,
	project,
	report,
	competitors,
	onSave,
	ideas,
	finding,
	canFind,
	onFind,
	onDismissIdeas,
	filter,
}: CompetitorsProps) {
	const tracked = new Set([project.name, ...competitors.map((c) => c.name)].map((n) => n.toLowerCase()));
	const fresh = (ideas ?? []).filter((idea) => !tracked.has(idea.name.toLowerCase()));
	const toEntity = (idea: CompetitorIdea): EntityView => ({
		name: idea.name,
		aliases: [],
		domains: idea.domain ? [idea.domain] : [],
	});
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [site, setSite] = useState("");
	const [aliases, setAliases] = useState<string[]>([]);
	const clean = name.trim();
	const taken =
		clean !== "" &&
		(competitors.some((c) => c.name.toLowerCase() === clean.toLowerCase()) ||
			project.name.toLowerCase() === clean.toLowerCase());
	const stats = new Map(report.competitors.map((c) => [c.name.toLowerCase(), c]));
	const brand = report.competitors.find((c) => c.isBrand);
	const own = brand?.name ?? project.name;
	const rows = [
		{ name: own, isBrand: true, detail: project.domains[0] ?? "" },
		...competitors.map((c) => ({
			name: c.name,
			isBrand: false,
			detail: [c.domains[0], c.aliases.length ? `also: ${c.aliases.join(", ")}` : ""].filter(Boolean).join(" · "),
		})),
	];
	const [picked, setPicked] = useState<string[]>([]);
	const chosen = competitors.filter((c) => picked.includes(c.name));
	const reset = () => {
		setName("");
		setSite("");
		setAliases([]);
	};
	const add = () => {
		if (!clean || taken) return;
		onSave([
			...competitors,
			{
				name: clean,
				aliases,
				domains: site.trim()
					? [
							site
								.trim()
								.replace(/^https?:\/\//i, "")
								.replace(/\/.*$/, ""),
						]
					: [],
			},
		]);
		setOpen(false);
		reset();
	};

	return (
		<Page
			brand={project.name}
			title="Competitors"
			actions={
				<>
					{filter}
					{chosen.length > 0 ? (
						<Button
							variant="destructive"
							size="sm"
							icon={<Icon icon={Delete02Icon} size={14} />}
							onClick={() => {
								onSave(competitors.filter((c) => !picked.includes(c.name)));
								setPicked([]);
							}}
						>
							{`Remove ${chosen.length}`}
						</Button>
					) : null}
					{canFind ? (
						<Button
							variant="ghost"
							size="sm"
							loading={finding}
							onClick={onFind}
							icon={<Icon icon={SparklesIcon} size={14} />}
						>
							Find competitors
						</Button>
					) : null}
					<Button size="sm" onClick={() => setOpen(true)} icon={<Icon icon={Add01Icon} size={14} />}>
						Add competitor
					</Button>
				</>
			}
		>
			<DataTable
				key={`${report.basedOnRunId ?? "none"}:${report.run?.status ?? "none"}:${report.competitors.length}`}
				title="You and your competitors in the latest answers"
				editable={false}
				columns={[
					{ key: "brand", label: "Brand", type: "title" },
					{ key: "site", label: "Website", type: "text" },
					{ key: "share", label: "Share of answers", type: "text", width: "160px" },
					{ key: "position", label: "Average position", type: "text", width: "160px" },
					{ key: "who", label: "Whose", type: "tag", width: "140px" },
				]}
				rows={rows.map((row) => {
					const stat = stats.get(row.name.toLowerCase());
					return {
						id: row.name,
						logo: <Avatar name={row.name} size={20} shape="square" />,
						brand: row.name,
						site: row.detail,
						share: stat ? `${Math.round(stat.mentionRate * 100)}%` : "Not run yet",
						position: !stat ? "Not run yet" : stat.averageRank === null ? "Not named" : stat.averageRank.toFixed(1),
						who: row.isBrand ? "You" : "Competitor",
					};
				})}
				tagTones={{ You: "green", Competitor: "gray" }}
				onSelectionChange={setPicked}
			/>
			<CompetitorInsight
				projectId={project.id}
				brand={project.name}
				engines={engines}
				runId={report.run?.status === "running" ? null : (report.run?.id ?? null)}
				names={[...competitors]
					.sort(
						(x, y) =>
							(stats.get(y.name.toLowerCase())?.mentionRate ?? 0) - (stats.get(x.name.toLowerCase())?.mentionRate ?? 0),
					)
					.map((c) => c.name)}
			/>

			{finding ? (
				<Card>
					<CardHeader
						icon={<Spinner />}
						title={`Finding ${project.name}'s competitors`}
						description="Your AI engine reads your website, your questions and the latest answers. This takes about half a minute."
					/>
				</Card>
			) : ideas ? (
				<Card>
					<CardHeader
						icon={
							<span className="oa-cta-mark">
								<SuggestMark />
							</span>
						}
						title={fresh.length ? `${fresh.length} likely competitors` : "Suggested competitors"}
						description="Found by your AI engine. Click the ones you really compete with; they are tracked from the next run."
						action={
							<span className="oa-inline">
								{fresh.length > 1 ? (
									<Button
										size="sm"
										onClick={() => onSave([...competitors, ...fresh.map(toEntity)])}
										icon={<Icon icon={Add01Icon} size={14} />}
									>
										Add all {fresh.length}
									</Button>
								) : null}
								<Button variant="ghost" size="sm" onClick={onDismissIdeas}>
									Dismiss
								</Button>
							</span>
						}
					/>
					<CardContent>
						{fresh.length === 0 ? (
							<EmptyState
								bare
								icon={UserMultipleIcon}
								title={ideas.length ? "You already track all of these" : "No competitors found"}
								text={
									ideas.length
										? "Press Find competitors again after your next run."
										: "The engine could not tell who you compete with. Add them yourself, or try again after a run."
								}
							/>
						) : (
							<div className="oa-suggest">
								{fresh.map((idea) => (
									<button
										key={idea.name}
										type="button"
										onClick={() => onSave([...competitors, toEntity(idea)])}
										aria-label={`Track ${idea.name}`}
									>
										<Avatar name={idea.name} size={20} shape="square" />
										<span className="oa-suggest-text">
											{idea.name}
											{idea.domain ? <small>{idea.domain}</small> : null}
										</span>
										<i aria-hidden="true">
											<Icon icon={Add01Icon} size={14} />
										</i>
									</button>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			) : null}

			{competitors.length === 0 ? (
				<div>
					<EmptyState
						icon={UserMultipleIcon}
						title="No competitors yet"
						text="Add the businesses you lose work to. OpenAEO then shows how often each is named beside you, and which questions they win."
						action={
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setOpen(true)}
								icon={<Icon icon={Add01Icon} size={14} />}
							>
								Add competitor
							</Button>
						}
					/>
				</div>
			) : null}

			<Dialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) reset();
				}}
				size="sm"
				title="Add a competitor"
				description="OpenAEO looks for this name in every answer from the next run."
				footer={
					<>
						<Button variant="secondary" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button disabled={!clean || taken} onClick={add} icon={<Icon icon={Add01Icon} size={14} />}>
							Add competitor
						</Button>
					</>
				}
			>
				<form
					className="oa-stack"
					onSubmit={(e) => {
						e.preventDefault();
						add();
					}}
				>
					<TextField
						label="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Acme Studio"
						error={taken ? "You already track this name." : undefined}
						autoFocus
					/>
					<TextField
						label="Website"
						optional
						value={site}
						onChange={(e) => setSite(e.target.value)}
						placeholder="acme.com"
						hint="Used to tell when an answer links to their site."
					/>
					<div>
						<TagInput
							aria-label="Other names"
							value={aliases}
							onChange={setAliases}
							placeholder="Other names they go by (optional)"
							max={10}
							normalize={(t) => t.trim()}
						/>
					</div>
				</form>
			</Dialog>
		</Page>
	);
}
