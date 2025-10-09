import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, UseQueryOptions } from "@tanstack/react-query";
import {
  ProjectionResult,
  ProjectionConfig,
  MilestoneProgress,
  FIREProgress,
  AssetProjectionRequest,
  PortfolioProjectionRequest,
  FIREProjectionConfig,
  ProjectionConfigWithDateRange,
} from "@shared/schema/projections";
import {
  assetProjection,
  portfolioProjection,
  milestoneProjection,
  milestonesProjection,
  fireProjection,
  fireCustomProjection,
} from "@shared/api/queryKeys";

// ============================================================================
// ASSET PROJECTION HOOK
// ============================================================================

/**
 * Hook for projecting a single asset's future value
 */
export function useAssetProjection(
  assetId: string | null,
  config: ProjectionConfig | null,
  options?: UseQueryOptions<ProjectionResult>
) {
  return useQuery<ProjectionResult>({
    queryKey: [...assetProjection, assetId, config],
    queryFn: async () => {
      if (!assetId || !config) {
        throw new Error("Asset ID and config are required");
      }

      const request: AssetProjectionRequest = {
        assetId,
        config,
      };

      return apiRequest<ProjectionResult>(
        "POST",
        `/api/projections/asset/${assetId}`,
        request
      );
    },
    enabled: !!assetId && !!config && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Mutation hook for ad-hoc asset projections
 */
export function useAssetProjectionMutation() {
  return useMutation<
    ProjectionResult,
    Error,
    { assetId: string; config: ProjectionConfig }
  >({
    mutationFn: async ({ assetId, config }) => {
      const request: AssetProjectionRequest = {
        assetId,
        config,
      };

      return apiRequest<ProjectionResult>(
        "POST",
        `/api/projections/asset/${assetId}`,
        request
      );
    },
  });
}

// ============================================================================
// PORTFOLIO PROJECTION HOOK
// ============================================================================

/**
 * Hook for projecting entire portfolio or filtered assets
 */
export function usePortfolioProjection(
  config: ProjectionConfigWithDateRange | null,
  options?: {
    accountTypeFilter?: string | null;
    assetIds?: string[];
    enabled?: boolean;
  } & UseQueryOptions<ProjectionResult>
) {
  const { accountTypeFilter, assetIds, enabled, ...queryOptions } =
    options || {};

  return useQuery<ProjectionResult>({
    queryKey: [...portfolioProjection, config, accountTypeFilter, assetIds],
    queryFn: async () => {
      if (!config) {
        throw new Error("Config is required");
      }

      const request: PortfolioProjectionRequest = {
        config,
        accountTypeFilter,
        assetIds,
      };

      return apiRequest<ProjectionResult>(
        "POST",
        `/api/projections/portfolio`,
        request
      );
    },
    enabled: !!config && (enabled ?? true),
    ...queryOptions,
  });
}

/**
 * Mutation hook for ad-hoc portfolio projections
 */
export function usePortfolioProjectionMutation() {
  return useMutation<ProjectionResult, Error, PortfolioProjectionRequest>({
    mutationFn: async (request) => {
      return apiRequest<ProjectionResult>(
        "POST",
        `/api/projections/portfolio`,
        request
      );
    },
  });
}

// ============================================================================
// MILESTONE PROJECTION HOOKS
// ============================================================================

/**
 * Hook for checking progress toward a specific milestone
 */
export function useMilestoneProjection(
  milestoneId: string | null,
  config: ProjectionConfig | null,
  options?: UseQueryOptions<MilestoneProgress>
) {
  return useQuery<MilestoneProgress>({
    queryKey: [...milestoneProjection, milestoneId, config],
    queryFn: async () => {
      if (!milestoneId || !config) {
        throw new Error("Milestone ID and config are required");
      }

      return apiRequest<MilestoneProgress>(
        "POST",
        `/api/projections/milestone/${milestoneId}`,
        { config }
      );
    },
    enabled: !!milestoneId && !!config && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Hook for checking progress on all user milestones
 */
export function useMilestonesProjection(
  config: ProjectionConfig | null,
  options?: UseQueryOptions<MilestoneProgress[]>
) {
  return useQuery<MilestoneProgress[]>({
    queryKey: [...milestonesProjection, config],
    queryFn: async () => {
      if (!config) {
        throw new Error("Config is required");
      }

      return apiRequest<MilestoneProgress[]>(
        "POST",
        `/api/projections/milestones`,
        { config }
      );
    },
    enabled: !!config && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Mutation hook for ad-hoc milestone progress check
 */
export function useMilestoneProjectionMutation() {
  return useMutation<
    MilestoneProgress,
    Error,
    { milestoneId: string; config: ProjectionConfig }
  >({
    mutationFn: async ({ milestoneId, config }) => {
      return apiRequest<MilestoneProgress>(
        "POST",
        `/api/projections/milestone/${milestoneId}`,
        { config }
      );
    },
  });
}

// ============================================================================
// FIRE PROJECTION HOOKS
// ============================================================================

/**
 * Hook for FIRE retirement projection using saved settings
 */
export function useFIREProjection(
  config: Omit<ProjectionConfig, "startDate" | "endDate"> | null,
  options?: UseQueryOptions<FIREProgress>
) {
  return useQuery<FIREProgress>({
    queryKey: [...fireProjection, config],
    queryFn: async () => {
      if (!config) {
        throw new Error("Config is required");
      }

      return apiRequest<FIREProgress>("POST", `/api/projections/fire`, {
        config,
      });
    },
    enabled: !!config && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Hook for FIRE retirement projection with custom configuration
 */
export function useCustomFIREProjection(
  config: Omit<ProjectionConfig, "startDate" | "endDate"> | null,
  fireConfig: FIREProjectionConfig | null,
  options?: UseQueryOptions<FIREProgress>
) {
  return useQuery<FIREProgress>({
    queryKey: [...fireCustomProjection, config, fireConfig],
    queryFn: async () => {
      if (!config || !fireConfig) {
        throw new Error("Config and FIRE config are required");
      }

      return apiRequest<FIREProgress>("POST", `/api/projections/fire/custom`, {
        config,
        fireConfig,
      });
    },
    enabled: !!config && !!fireConfig && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Mutation hook for ad-hoc FIRE projection
 */
export function useFIREProjectionMutation() {
  return useMutation<
    FIREProgress,
    Error,
    {
      config: Omit<ProjectionConfig, "startDate" | "endDate">;
      fireConfig?: FIREProjectionConfig;
    }
  >({
    mutationFn: async ({ config, fireConfig }) => {
      if (fireConfig) {
        return apiRequest<FIREProgress>(
          "POST",
          `/api/projections/fire/custom`,
          {
            config,
            fireConfig,
          }
        );
      }

      return apiRequest<FIREProgress>("POST", `/api/projections/fire`, {
        config,
      });
    },
  });
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook that combines portfolio projection with milestone tracking
 */
export function usePortfolioWithMilestoneProjection(
  config: ProjectionConfigWithDateRange | null,
  milestoneId: string | null,
  options?: UseQueryOptions<ProjectionResult>
) {
  return useQuery<ProjectionResult>({
    queryKey: [...portfolioProjection, "milestone", milestoneId, config],
    queryFn: async () => {
      if (!config) {
        throw new Error("Config is required");
      }

      // Get milestone details first
      if (!milestoneId) {
        throw new Error("Milestone ID is required");
      }

      const milestone = await apiRequest<{
        id: string;
        name: string;
        targetValue: string;
        accountType: string | null;
      }>("GET", `/api/milestones/${milestoneId}`);

      const request: PortfolioProjectionRequest = {
        config,
        accountTypeFilter: milestone.accountType,
        milestoneTarget: {
          milestoneId: milestone.id,
          milestoneName: milestone.name,
          targetValue: Number(milestone.targetValue),
          targetDate: config.endDate,
          accountType: milestone.accountType,
        },
      };

      return apiRequest<ProjectionResult>(
        "POST",
        `/api/projections/portfolio`,
        request
      );
    },
    enabled: !!config && !!milestoneId && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Hook that combines portfolio projection with FIRE analysis
 */
export function usePortfolioWithFIREProjection(
  config: ProjectionConfig | null
  //options?: UseQueryOptions<ProjectionResult & { fireProgress: FIREProgress }>
) {
  return useQuery<ProjectionResult & { fireProgress: FIREProgress }>({
    queryKey: [...portfolioProjection, "fire", config],
    queryFn: async () => {
      if (!config) {
        throw new Error("Config is required");
      }

      const request: PortfolioProjectionRequest = {
        config: {
          ...config,
          startDate: new Date(),
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 30)
          ),
        },
      };

      // Portfolio projection endpoint automatically includes FIRE if fireConfig present
      // But we'll use dedicated FIRE endpoint for cleaner separation
      const [portfolioResult, fireProgress] = await Promise.all([
        apiRequest<ProjectionResult>("POST", `/api/projections/portfolio`, {
          config: {
            ...config,
            startDate: new Date(),
            endDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 30)
            ),
          } as ProjectionConfigWithDateRange,
        }),
        apiRequest<FIREProgress>("POST", `/api/projections/fire`, { config }),
      ]);

      return {
        ...portfolioResult,
        fireProgress,
      };
    },
    //enabled: !!config && (options?.enabled ?? true),
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for creating default simple projection config
 * Useful for quick projections without user configuration
 */
export function useDefaultSimpleProjectionConfig(
  yearsAhead: number = 5,
  growthRate: number = 7.0
): ProjectionConfigWithDateRange {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + yearsAhead);

  return {
    mode: "simple",
    growthModel: "compound",
    growthRate,
    startDate,
    endDate,
    interval: "yearly",
    modifiers: [],
  };
}

/**
 * Hook for creating default advanced projection config
 */
export function useDefaultAdvancedProjectionConfig(
  yearsAhead: number = 10,
  historicalMonths: number = 36
): ProjectionConfigWithDateRange {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + yearsAhead);

  return {
    mode: "advanced",
    growthModel: "compound",
    historicalPeriodMonths: historicalMonths,
    blendRatio: 0.5,
    startDate,
    endDate,
    interval: "yearly",
    modifiers: [],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const useProjections = {
  // Primary hooks
  asset: useAssetProjection,
  portfolio: usePortfolioProjection,
  milestone: useMilestoneProjection,
  milestones: useMilestonesProjection,
  fire: useFIREProjection,
  customFire: useCustomFIREProjection,

  // Mutations
  assetMutation: useAssetProjectionMutation,
  portfolioMutation: usePortfolioProjectionMutation,
  milestoneMutation: useMilestoneProjectionMutation,
  fireMutation: useFIREProjectionMutation,

  // Convenience
  portfolioWithMilestone: usePortfolioWithMilestoneProjection,
  portfolioWithFire: usePortfolioWithFIREProjection,

  // Utilities
  defaultSimpleConfig: useDefaultSimpleProjectionConfig,
  defaultAdvancedConfig: useDefaultAdvancedProjectionConfig,
};

