import type { EntityInput, Project, ProjectInput, Store } from "./store/types";

export type NewProject = ProjectInput & { competitors: EntityInput[]; prompts: string[] };

export async function createProject(store: Store, input: NewProject): Promise<Project> {
	const created = await store.projects.create(input);
	await store.competitors.replace(created.id, input.competitors);
	await store.prompts.add(created.id, input.prompts);
	return created;
}
