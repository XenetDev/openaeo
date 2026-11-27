import type { PageId, ProjectView } from "@api";
import type { ReactNode } from "react";

export type HostNav = { open: (tab: string) => void };
export type HostTab = { id: string; label: string; render: (nav: HostNav) => ReactNode };

export const HOST_TABS: HostTab[] = [];

export const openingTab = (): string | null => null;

export const HOST_POSTS: ((project: ProjectView) => ReactNode) | null = null;

export const HOST_LOADING: Partial<Record<PageId, (brand: string) => ReactNode>> = {};
