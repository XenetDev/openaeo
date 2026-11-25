import type { PageId } from "@api";
import { Card, CardContent } from "@/components/ui/card-clean";
import { Skeleton } from "@/components/ui/skeleton-clean";
import { pageLabel } from "../app/pages";
import { OverviewSkeleton } from "./overview";
import { Page } from "./shared";

const CARDS = [
	["38%", "100%", "100%", "100%", "72%"],
	["30%", "100%", "64%"],
];

export function LoadingScreen({ brand, page }: { brand: string; page: PageId }) {
	if (page === "overview") return <OverviewSkeleton brand={brand} />;
	return (
		<Page brand={brand} title={pageLabel(page)}>
			<div className="oa-stack" role="status" aria-label={`Loading ${pageLabel(page)}`}>
				{CARDS.map((lines) => (
					<Card key={lines.length}>
						<CardContent>
							<div className="oa-stack">
								{lines.map((width, line) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder lines that never reorder
									<Skeleton key={line} height={14} width={width} />
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</Page>
	);
}
