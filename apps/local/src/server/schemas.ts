import { z } from "zod";
import { API_ENGINES, ENGINE_IDS } from "../engine-catalog";
import { MAX_LOCATION } from "../location";

export const MAX_ENTITY_TEXT = 200;
export const MAX_COMPETITORS = 50;
export const PromptTextSchema = z.string().max(2000);

export const SCHEDULES = ["off", "daily", "weekly"] as const;
export const NamesSchema = z.array(z.string().max(MAX_ENTITY_TEXT)).max(50);
export const LocationSchema = z.string().trim().max(MAX_LOCATION);
export const PromptTagsSchema = z.array(z.string().max(200)).max(50);

const names = NamesSchema.default([]);

export const EntitySchema = z.object({
	name: z.string().trim().min(1, "name is required").max(MAX_ENTITY_TEXT),
	aliases: names,
	domains: names,
});

const location = LocationSchema.optional();

export const ProjectSchema = EntitySchema.extend({ location });

export const CreateProjectSchema = ProjectSchema.extend({
	competitors: z.array(EntitySchema).max(MAX_COMPETITORS).default([]),
	prompts: z.array(PromptTextSchema).max(200).default([]),
});

export const CompetitorsSchema = z.object({ competitors: z.array(EntitySchema).max(MAX_COMPETITORS) });
export const AddPromptsSchema = z.object({ texts: z.array(PromptTextSchema).min(1).max(200) });
export const StartAuditSchema = z.object({ url: z.string().trim().max(2000).optional() });
export const AskSchema = z.object({
	question: z.string().trim().min(1, "Type a question first").max(2000),
	history: z
		.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(20_000) }))
		.max(40)
		.default([]),
	engine: z.string().max(40).optional(),
});
export const CompetitorIdeasSchema = z.object({
	name: z.string().trim().min(1, "name is required").max(200),
	domain: z.string().trim().max(300).optional(),
	location,
});
export const PlanStepSchema = z.object({ done: z.boolean() });
export const PatchPromptSchema = z
	.object({ active: z.boolean().optional(), tags: PromptTagsSchema.optional() })
	.refine((input) => input.active !== undefined || input.tags !== undefined, "Send active or tags.");

const toggle = z.enum(["true", "false"]);
const model = z.string().trim().max(100);

const API_IDS = API_ENGINES.map((api) => api.id);

export const SettingsSchema = z
	.object({
		...Object.fromEntries(
			API_IDS.flatMap((id) => [
				[`${id}.apiKey`, z.string().trim().max(400)],
				[`${id}.model`, model],
			]),
		),
		"claude.model": model,
		"codex.model": model,
		schedule: z.enum(SCHEDULES),
		...Object.fromEntries(ENGINE_IDS.map((id) => [`engine.${id}.enabled`, toggle])),
	} as Record<string, z.ZodType<string>>)
	.partial()
	.strict();

export const SECRET_SETTINGS = new Set(API_IDS.map((id) => `${id}.apiKey`));
export const MASK = "••••";
