import type { EntityView, ProjectView, ReportView } from "@openaeo/ui";
import { News01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { DataTable } from "@/components/ui/data-table-clean";
import { Dialog } from "@/components/ui/dialog-clean";
import { TagInput } from "@/components/ui/tag-input-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { Page } from "./shared";

export function SourcesScreen({ project, report }: { project: ProjectView; report: ReportView }) {
	return (
		<Page brand={project.name} title="Sources">
			{report.topDomains.length === 0 ? (
				<EmptyState icon={News01Icon} title="No sources yet" text="After a run, this lists the sites the engines linked to in their answers. These are the places worth being mentioned on." />
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
					rows={report.topDomains.map((d) => ({ id: d.domain, logo: <Avatar name={d.domain} size={20} shape="square" />, site: d.domain, citations: d.citations, owner: d.isBrand ? "Yours" : "Other", link: `https://${d.domain}` }))}
					tagTones={{ Yours: "green", Other: "gray" }}
				/>
			)}
		</Page>
	);
}

type CompetitorsProps = { project: ProjectView; report: ReportView; competitors: EntityView[]; onSave: (next: EntityView[]) => void };

export function CompetitorsScreen({ project, report, competitors, onSave }: CompetitorsProps) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [site, setSite] = useState("");
	const [aliases, setAliases] = useState<string[]>([]);
	const clean = name.trim();
	const taken = clean !== "" && (competitors.some((c) => c.name.toLowerCase() === clean.toLowerCase()) || project.name.toLowerCase() === clean.toLowerCase());
	const stats = new Map(report.competitors.map((c) => [c.name.toLowerCase(), c]));
	const brand = report.competitors.find((c) => c.isBrand);
	const rows = [
		...(brand ? [{ name: brand.name, isBrand: true }] : [{ name: project.name, isBrand: true }]),
		...competitors.map((c) => ({ name: c.name, isBrand: false })),
	];
	const reset = () => {
		setName("");
		setSite("");
		setAliases([]);
	};
	const add = () => {
		if (!clean || taken) return;
		onSave([...competitors, { name: clean, aliases, domains: site.trim() ? [site.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")] : [] }]);
		setOpen(false);
		reset();
	};

	return (
		<Page
			brand={project.name}
			title="Competitors"
			actions={
				<Button size="sm" onClick={() => setOpen(true)}>
					Add competitor
				</Button>
			}
		>
			<DataTable
				title="Who gets named in the latest answers"
				editable={false}
				columns={[
					{ key: "brand", label: "Brand", type: "title" },
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
						share: stat ? `${Math.round(stat.mentionRate * 100)}%` : "Not run yet",
						position: !stat ? "Not run yet" : stat.averageRank === null ? "Not named" : stat.averageRank.toFixed(1),
						who: row.isBrand ? "You" : "Competitor",
					};
				})}
				tagTones={{ You: "green", Competitor: "gray" }}
			/>

			{competitors.length === 0 ? (
				<Card>
					<CardHeader
						title="You are not tracking any competitors yet"
						description="Add the businesses you lose work to. OpenAEO then shows how often each is named beside you, and which questions they win."
						action={
							<Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
								Add competitor
							</Button>
						}
					/>
				</Card>
			) : (
				<Card>
					<CardHeader title="Tracked competitors" description="Changes apply from the next run." />
					<CardContent>
						<div className="oa-missed">
							{competitors.map((c) => (
								<div key={c.name}>
									<Avatar name={c.name} size={20} shape="square" />
									<span className="oa-grow">
										<b>{c.name}</b>
										{c.domains[0] || c.aliases.length ? <span>{[c.domains[0], c.aliases.length ? `also: ${c.aliases.join(", ")}` : ""].filter(Boolean).join(" · ")}</span> : null}
									</span>
									<Button variant="ghost" size="sm" aria-label={`Remove ${c.name}`} onClick={() => onSave(competitors.filter((x) => x.name !== c.name))}>
										Remove
									</Button>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

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
						<Button disabled={!clean || taken} onClick={add}>
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
					<TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Studio" error={taken ? "You already track this name." : undefined} autoFocus />
					<TextField label="Website" optional value={site} onChange={(e) => setSite(e.target.value)} placeholder="acme.com" hint="Used to tell when an answer links to their site." />
					<div>
						<TagInput aria-label="Other names" value={aliases} onChange={setAliases} placeholder="Other names they go by (optional)" max={10} normalize={(t) => t.trim()} />
					</div>
				</form>
			</Dialog>
		</Page>
	);
}
