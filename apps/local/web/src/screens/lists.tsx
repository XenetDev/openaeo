import type { EntityView, ProjectView, ReportView } from "@openaeo/ui";
import { News01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card-clean";
import { DataTable } from "@/components/ui/data-table-clean";
import { TagInput } from "@/components/ui/tag-input-clean";
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
	const [names, setNames] = useState(competitors.map((c) => c.name));
	const dirty = names.join("\n") !== competitors.map((c) => c.name).join("\n");
	return (
		<Page brand={project.name} title="Competitors">
			<DataTable
				title="Who gets mentioned in the latest answers"
				editable={false}
				columns={[
					{ key: "brand", label: "Brand", type: "title" },
					{ key: "share", label: "Share of answers", type: "number", width: "160px", format: (n: number) => `${Math.round(n)}%` },
					{ key: "position", label: "Average position", type: "text", width: "160px" },
					{ key: "who", label: "Whose", type: "tag", width: "140px" },
				]}
				rows={report.competitors.map((c) => ({
					id: c.name,
					logo: <Avatar name={c.name} size={20} shape="square" />,
					brand: c.name,
					share: c.mentionRate * 100,
					position: c.averageRank === null ? "Not mentioned" : c.averageRank.toFixed(1),
					who: c.isBrand ? "You" : "Competitor",
				}))}
				tagTones={{ You: "green", Competitor: "gray" }}
			/>
			<Card>
				<CardHeader title="Tracked competitors" description="Type a name and press Enter. Changes apply from the next run." />
				<CardContent>
					<div className="oa-narrow">
						<TagInput aria-label="Tracked competitors" value={names} onChange={setNames} placeholder="Add a competitor" max={50} normalize={(t) => t.trim()} />
					</div>
				</CardContent>
				<CardFooter>
					<Button
						size="sm"
						disabled={!dirty}
						onClick={() => {
							const known = new Map(competitors.map((c) => [c.name.toLowerCase(), c]));
							onSave(names.map((name) => known.get(name.toLowerCase()) ?? { name, aliases: [], domains: [] }));
						}}
					>
						Save competitors
					</Button>
				</CardFooter>
			</Card>
		</Page>
	);
}
