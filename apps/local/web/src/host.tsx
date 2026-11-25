import type { ReactNode } from "react";

export type HostTab = { id: string; label: string; render: () => ReactNode };

export const HOST_TABS: HostTab[] = [];
