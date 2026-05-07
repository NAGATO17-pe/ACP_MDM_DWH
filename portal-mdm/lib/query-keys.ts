/**
 * Centralized TanStack Query keys.
 *
 * Use these instead of inline string arrays so refactors stay consistent
 * across `useQuery` and `invalidateQueries` call sites.
 *
 * Example:
 * ```ts
 * useQuery({ queryKey: qk.workflows(), queryFn: getWorkflows });
 * queryClient.invalidateQueries({ queryKey: qk.workflows() });
 * ```
 */
export const qk = {
  entities: (params?: { type?: string; status?: string; page?: number; size?: number }) =>
    params ? (["entities", params] as const) : (["entities"] as const),
  workflows: (status?: string) =>
    status ? (["workflows", status] as const) : (["workflows"] as const),
  audit: (action: string, page: number) => ["audit", action, page] as const,
  models: () => ["models"] as const,
  modelById: (id: string) => ["models", id] as const,
  qualityOverview: () => ["quality", "overview"] as const,
  executiveOverview: () => ["quality", "executive"] as const,
} as const;
