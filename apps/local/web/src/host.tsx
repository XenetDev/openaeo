import type { PageId, ProjectView } from "@api";
import type { ReactNode } from "react";

export type HostNav = { open: (tab: string) => void };
export type HostTab = { id: string; label: string; render: (nav: HostNav) => ReactNode };

export const HOST_TABS: HostTab[] = [];

export const openingTab = (): string | null => null;

export const HOST_POSTS: ((project: ProjectView) => ReactNode) | null = null;

export const HOST_LOADING: Partial<Record<PageId, (brand: string) => ReactNode>> = {};

/** Extra places Aeo can open, e.g. a settings tab. `open` returns the page to show. */
export const HOST_PLACES: { id: string; label: string }[] = [];
export const openPlace = (place: string): string => place.split(":")[0] ?? place;
