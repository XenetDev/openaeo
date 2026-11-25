import type { ReactNode } from "react";

export type HostNav = { open: (tab: string) => void };
export type HostTab = { id: string; label: string; render: (nav: HostNav) => ReactNode };

export const HOST_TABS: HostTab[] = [];

export const openingTab = (): string | null => null;
