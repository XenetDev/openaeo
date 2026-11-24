import type { ReactNode } from "react";

function Tile({ id, from, to, children }: { id: string; from: string; to: string; children: (fill: string) => ReactNode }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
					<stop stopColor={from} />
					<stop offset="1" stopColor={to} />
				</linearGradient>
			</defs>
			{children(`url(#${id})`)}
		</svg>
	);
}

export const RunMark = () => (
	<Tile id="oa-cmd-run" from="#34C77B" to="#12A5A0">
		{(fill) => <path fill={fill} d="M8.2 4.9c0-1 1.1-1.6 2-1.1l10 6.9c.8.5.8 1.7 0 2.2l-10 6.9c-.9.6-2 0-2-1.1z" />}
	</Tile>
);

export const AuditMark = () => (
	<Tile id="oa-cmd-audit" from="#2F9BFF" to="#5B6CFF">
		{(fill) => (
			<path
				fill={fill}
				fillRule="evenodd"
				d="M12 2.5 4.5 5.4v5.9c0 4.7 3.1 8.3 7.5 10.2 4.4-1.9 7.5-5.5 7.5-10.2V5.4zm4.300 7.400a1 1 0 0 0-1.500-1.300l-3.700 4.300-1.800-1.800a1 1 0 1 0-1.400 1.400l2.600 2.600a1 1 0 0 0 1.500-.1z"
			/>
		)}
	</Tile>
);

export const SuggestMark = () => (
	<Tile id="oa-cmd-suggest" from="#7C5CFF" to="#EE3E9E">
		{(fill) => <path fill={fill} d="M12 2.5c.6 3.900 2.100 6.400 4.400 7.600 1.100.6 2.400.9 4.100 1.100v1.600c-4.600.6-7.300 3-8.500 8.700h-1.600c-.6-3.900-2.100-6.400-4.400-7.600-1.100-.6-2.400-.9-4.100-1.100v-1.600c4.600-.6 7.300-3 8.500-8.700z" />}
	</Tile>
);

export const BriefMark = () => (
	<Tile id="oa-cmd-brief" from="#F28A2E" to="#E8B000">
		{(fill) => (
			<path
				fill={fill}
				fillRule="evenodd"
				d="M7 3h7.200L19 7.800V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1.500 8.250a.75.75 0 0 0 0 1.500h7a.75.75 0 0 0 0-1.500zm0 3.500a.75.75 0 0 0 0 1.500h4.500a.75.75 0 0 0 0-1.500z"
			/>
		)}
	</Tile>
);

export const BrandMark = () => (
	<Tile id="oa-cmd-brand" from="#EE3E9E" to="#F28A2E">
		{(fill) => (
			<path
				fill={fill}
				fillRule="evenodd"
				d="M12 2.5a9.500 9.500 0 1 0 0 19 9.500 9.500 0 0 0 0-19zm1 5.500a1 1 0 1 0-2 0v3H8a1 1 0 1 0 0 2h3v3a1 1 0 1 0 2 0v-3h3a1 1 0 1 0 0-2h-3z"
			/>
		)}
	</Tile>
);

export const AgentMark = () => (
	<Tile id="oa-cmd-agent" from="#13B3A0" to="#2F9BFF">
		{(fill) => (
			<path
				fill={fill}
				fillRule="evenodd"
				d="M9 3a1 1 0 0 1 1 1v3h4V4a1 1 0 1 1 2 0v3h1a1 1 0 0 1 1 1v3.500a6 6 0 0 1-5 5.900V20a1 1 0 1 1-2 0v-2.600a6 6 0 0 1-5-5.900V8a1 1 0 0 1 1-1h1V4a1 1 0 0 1 1-1z"
			/>
		)}
	</Tile>
);
