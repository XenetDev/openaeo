import type { BrandCheckView, EngineView } from "@api";
import { type CSSProperties, useId, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { EngineLogo, engineLabel } from "./shared";

const KNOWS: Record<string, { label: string; tone: BadgeTone }> = {
	yes: { label: "Knows you", tone: "success" },
	partly: { label: "Unsure about you", tone: "warning" },
	no: { label: "Does not know you", tone: "danger" },
	unclear: { label: "Not analysed", tone: "neutral" },
};

const COMPACT = 4;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function SiteUsed({ used }: { used: boolean }) {
	return <Badge tone={used ? "success" : "warning"}>{used ? "Your site was used" : "Your site was not used"}</Badge>;
}

export function BrandChecks({
	brand,
	checks,
	engines,
}: {
	brand: string;
	checks: BrandCheckView[];
	engines: EngineView[];
}) {
	const [open, setOpen] = useState(false);
	const id = useId();
	const shown = open ? checks : checks.slice(0, COMPACT);

	return (
		<Card>
			<CardHeader
				title={`What AI says when asked about ${brand}`}
				description="Each engine was asked what your company is and does. This is separate from your tracked questions."
				action={
					<Button
						size="sm"
						variant="ghost"
						aria-expanded={open}
						aria-controls={id}
						onClick={() => setOpen((value) => !value)}
					>
						{open ? "Show less" : "Show more"}
					</Button>
				}
			/>
			<CardContent>
				<div
					id={id}
					className="oa-brand"
					data-compact={open ? undefined : ""}
					style={{ "--n": Math.min(shown.length, COMPACT), "--n-narrow": Math.min(shown.length, 2) } as CSSProperties}
				>
					{shown.map((check) => {
						const known = KNOWS[check.knows ?? "unclear"] ?? KNOWS.unclear;
						return (
							<article key={check.engine}>
								<header>
									<EngineLogo engine={check.engine} label={engineLabel(engines, check.engine)} size={16} />
									<b>{engineLabel(engines, check.engine)}</b>
									<Badge tone={known?.tone}>{known?.label}</Badge>
								</header>
								{check.summary ? <p>{check.summary}</p> : null}
								{open ? (
									<>
										<section>
											<small>Where it got this</small>
											<span className="oa-inline">
												<SiteUsed used={check.ownSiteUsed} />
												{check.sources.slice(0, 6).map((domain) => (
													<Badge key={domain}>{domain}</Badge>
												))}
												{check.sources.length === 0 ? <Badge>Its own memory</Badge> : null}
											</span>
										</section>
										{check.concerns.length > 0 ? (
											<section>
												<small>Doubts it raised</small>
												<ul>
													{check.concerns.map((concern) => (
														<li key={concern}>{concern}</li>
													))}
												</ul>
											</section>
										) : null}
									</>
								) : (
									<footer>
										<SiteUsed used={check.ownSiteUsed} />
										<small>
											{[
												check.sources.length > 0 ? count(check.sources.length, "source", "sources") : "Its own memory",
												check.concerns.length > 0 ? count(check.concerns.length, "doubt", "doubts") : null,
											]
												.filter(Boolean)
												.join(" · ")}
										</small>
									</footer>
								)}
							</article>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
