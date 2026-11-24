import { z } from "zod";

const names = z.array(z.string().max(200)).max(50).default([]);

export const EntitySchema = z.object({
	name: z.string().trim().min(1, "name is required").max(200),
	aliases: names,
	domains: names,
});

export const CreateProjectSchema = EntitySchema.extend({
	competitors: z.array(EntitySchema).max(50).default([]),
	prompts: z.array(z.string().max(2000)).max(200).default([]),
});

export const CompetitorsSchema = z.object({ competitors: z.array(EntitySchema).max(50) });
export const AddPromptsSchema = z.object({ texts: z.array(z.string().max(2000)).min(1).max(200) });
export const PatchPromptSchema = z.object({ active: z.boolean() });

const toggle = z.enum(["true", "false"]);
const model = z.string().trim().max(100);

export const SettingsSchema = z
	.object({
		"openai.apiKey": z.string().trim().max(400),
		"openai.model": model,
		"claude.model": model,
		"codex.model": model,
		schedule: z.enum(["off", "daily", "weekly"]),
		"engine.claude-cli.enabled": toggle,
		"engine.codex-cli.enabled": toggle,
		"engine.openai.enabled": toggle,
	})
	.partial()
	.strict();

export const SECRET_SETTINGS = new Set(["openai.apiKey"]);
export const MASK = "••••";
