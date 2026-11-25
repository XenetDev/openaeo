import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Project, Store } from "../store/types";

export type Reply = { content: { type: "text"; text: string }[]; isError?: boolean };
export type McpContext = {
	server: McpServer;
	store: Store;
	resolve: (name: string | undefined) => Promise<Project | Reply>;
};

export const projectArg = {
	project: z.string().max(200).optional().describe("Project (brand) name. Defaults to the first project."),
};

export const say = (text: string): Reply => ({ content: [{ type: "text", text }] });
export const fail = (text: string): Reply => ({ content: [{ type: "text", text }], isError: true });
export const isReply = (value: Project | Reply): value is Reply => "content" in value;

export const oneLine = (text: string) => text.replace(/[\s\u0085\u2028\u2029]+/g, " ").trim();
export const sameText = (text: string) => text.trim().toLowerCase();
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export const quoted = (text: string, max: number) =>
	(text.length > max ? `${text.slice(0, max)}…` : text)
		.split(/[\n\r\u0085\u2028\u2029]+/)
		.map((line) => `> ${line}`)
		.join("\n");
