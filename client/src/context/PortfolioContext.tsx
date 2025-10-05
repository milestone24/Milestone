import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  skipToken,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  Milestone,
  FireSettings,
  SessionUser,
  UserAsset,
  UserAssetOrphanInsert,
  AssetsChange,
  AssetValue,
  UserAssetValueInsert,
  AssetTransaction,
  AssetContributionInsert,
  MilestoneOrphanInsert,
  FireSettingsInsert,
  UserAssetWithHistoryAndAccountChange,
  MilestoneInsert,
  FireSettingsOrphan,
} from "@shared/schema";
import { getEndpointPathWithUserId } from "@/lib/user";
import { useSession } from "@/hooks/use-session";
import { AccountType } from "@shared/schema";
import { getDateUrlParams } from "@/lib/date";
import {
  portfolioAssets,
  portfolioGraphTransactions,
  portfolioGraphValues,
} from "@/api/queryKeys";

export type PortfolioContextType = {
  assets: UserAsset[];
  milestones: Milestone[];
  fireSettings: FireSettings | null;
  activeSection: string;
  portfolioOverview: AssetsChange;
};

type UserAssetUpdate = UserAssetOrphanInsert & {
  id: UserAsset["id"];
};

type AssetValueUpdate = UserAssetValueInsert & {
  historyId: AssetValue["id"];
};

type AssetContributionUpdate = AssetContributionInsert & {
  contributionId: AssetTransaction["id"];
};

type AssetValueDelete = {
  assetId: UserAsset["id"];
  historyId: AssetValue["id"];
};

type MilestoneUpdate = MilestoneOrphanInsert & {
  id: Milestone["id"];
};

type FireSettingsUpdate = FireSettingsInsert & {
  id: FireSettings["id"];
};

// Create the context
const PortfolioContext = createContext<PortfolioContextType | undefined>(
  undefined
);
// Provider component
export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const value: PortfolioContextType = {
    assets: [],
    milestones: [],
    fireSettings: null,
    activeSection: "portfolio",
    portfolioOverview: {
      value: 0,
      currentChange: 0,
      currentChangePercentage: 0,
      startValue: 0,
      startDate: new Date(),
      endDate: new Date(),
    },
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

// Custom hook to use the portfolio context
export const usePortfolio = (startDate?: Date, endDate?: Date) => {
  const context = useContext(PortfolioContext);

  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }

  const { user, isSessionPending, logout } = useSession();

  const queryClient = useQueryClient();

  const apiEnabled = !isSessionPending && !!user;

  const getAuthQueryKey = (
    (user: SessionUser | null) =>
    (path: string[]): string[] => {
      //TODO DOUBLE CHECK USER IS NOT NULL
      return [
        ...path.map((p) =>
          getEndpointPathWithUserId(p, user?.account.id ?? "none")
        ),
        ...(user?.account.id ? [user.account.id] : []),
      ];
    }
  )(user);

  const milestonesQueryKey = getAuthQueryKey(["/api/milestones/user/{userId}"]);
  const fireSettingsQueryKey = getAuthQueryKey([
    "/api/fire-settings/user/{userId}",
  ]);

  const invalidateAccounts = useCallback(() => {
    queryClient.invalidateQueries({
      //We need fetch all queries for the time being
      //The portolfio chart is out of view and so would not be refetched otherwise
      refetchType: "all",
    });
    //We are using all for the time being, we can refine this later
    // [
    //   { queryKey: accountsQueryKey },
    //   { queryKey: accountsHistoryQueryKey },
    //   { queryKey: portfolioValueQueryKey },
    //   {
    //     predicate: (query) => {
    //       console.log("query", query);
    //       return query.queryKey.includes(portfolioHistoryPath);
    //     },
    //   },
    // ].forEach((query) => {
    //   queryClient.invalidateQueries(query);
    // });
  }, []);

  const invalidateMilestones = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: milestonesQueryKey });
  }, [milestonesQueryKey]);

  const invalidateFireSettings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: fireSettingsQueryKey });
  }, [fireSettingsQueryKey]);

  // Fetch assets
  const {
    data: assets = [],
    isLoading: isLoadingAssets,
    isError: isAssetsError,
  } = useQuery<UserAssetWithHistoryAndAccountChange[]>({
    queryKey: [...portfolioAssets, startDate, endDate],
    queryFn: apiEnabled
      ? async () =>
          apiRequest(
            "GET",
            `/api/assets?${getDateUrlParams(startDate, endDate)}`
          )
      : skipToken,
  });

  // Fetch milestones
  const {
    data: milestones = [],
    isLoading: isLoadingMilestones,
    isError: isMilestonesError,
  } = useQuery<Milestone[]>({
    queryKey: milestonesQueryKey,
    queryFn: apiEnabled
      ? async () => apiRequest("GET", milestonesQueryKey[0] ?? "")
      : skipToken,
  });

  // Fetch FIRE settings
  const {
    data: fireSettings,
    isLoading: isLoadingFireSettings,
    isError: isFireSettingsError,
  } = useQuery<FireSettings>({
    queryKey: fireSettingsQueryKey,
    queryFn: apiEnabled
      ? async () => apiRequest("GET", fireSettingsQueryKey[0] ?? "")
      : skipToken,
  });

  // Fetch total portfolio value
  const { data: portfolioOverview, isLoading: isLoadingPortfolioOverview } =
    useQuery<AssetsChange>({
      queryKey: ["/api/assets/portfolio-value", startDate, endDate],
      queryFn: apiEnabled
        ? async () =>
            await apiRequest(
              "GET",
              `/api/assets/portfolio-value?${getDateUrlParams(
                startDate,
                endDate
              )}`
            )
        : skipToken,
    });

  // Mutations for assets
  const addAsset = useMutation<UserAsset, Error, UserAssetOrphanInsert>({
    mutationFn: (newAsset) =>
      apiRequest<UserAsset>("POST", "/api/assets/", {
        ...newAsset,
        userAccountId: user?.account.id,
        securities: newAsset.securities.map((security) => ({
          ...security,
          recordedAt: security.recordedAt ?? new Date(),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset added",
        description: "Your asset has been added successfully.",
      });
    },
    onError: (error) => {
      console.error("Error adding asset", error);
      toast({
        title: "Error adding asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateAsset = useMutation<UserAsset, Error, UserAssetUpdate>({
    mutationFn: (data) => {
      const { id, ...rest } = data;
      return apiRequest<UserAsset>("PUT", `/api/assets/${id}`, {
        ...rest,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset updated",
        description: "Your asset has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteAsset = useMutation<void, Error, UserAsset["id"]>({
    mutationFn: (id) => apiRequest<void>("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset deleted",
        description: "Your asset has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Add new mutations for account history
  const addAssetValue = useMutation<
    UserAssetValueInsert,
    Error,
    UserAssetValueInsert
  >({
    mutationFn: (data: UserAssetValueInsert) => {
      const { assetId, ...rest } = data;
      return apiRequest<AssetValue>("POST", `/api/assets/${assetId}/history`, {
        ...rest,
        recordedAt: data.recordedAt ?? new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset value added",
        description: "Asset value has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateAssetValue = useMutation<AssetValue, Error, AssetValueUpdate>({
    mutationFn: (data) => {
      const { assetId, historyId, ...rest } = data;
      return apiRequest<AssetValue>(
        "PUT",
        `/api/assets/${assetId}/history/${historyId}`,
        {
          ...rest,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset value updated",
        description: "Asset value has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteAssetValue = useMutation<void, Error, AssetValueDelete>({
    mutationFn: ({ assetId, historyId }) =>
      apiRequest<void>("DELETE", `/api/assets/${assetId}/history/${historyId}`),
    onSuccess: () => {
      invalidateAccounts();
      toast({
        title: "Asset value deleted",
        description: "Asset value has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const connectAssetApi = useMutation<
    void,
    Error,
    { id: UserAsset["id"]; apiKey: string }
  >({
    mutationFn: async ({ id, apiKey }) =>
      apiRequest("PATCH", `/api/assets/${id}/connect-api`, {
        apiKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      toast({
        title: "API connected",
        description: "Your asset has been connected to the API successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Asset contribution mutations
  const addAssetContribution = useMutation<
    AssetTransaction,
    Error,
    AssetContributionInsert
  >({
    mutationFn: (data: AssetContributionInsert) => {
      const { assetId, ...rest } = data;
      return apiRequest<AssetTransaction>(
        "POST",
        `/api/assets/${assetId}/contributions`,
        {
          ...rest,
          recordedAt: new Date(),
        }
      );
    },
    onSuccess: (data) => {
      invalidateAccounts();
      queryClient.invalidateQueries({
        queryKey: ["asset", data.assetId, "contributions"],
      });
      toast({
        title: "Contribution recorded",
        description: "Your contribution has been recorded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error recording contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateAssetContribution = useMutation<
    AssetTransaction,
    Error,
    AssetContributionUpdate
  >({
    mutationFn: (data) => {
      const { assetId, contributionId, ...rest } = data;
      return apiRequest<AssetTransaction>(
        "PUT",
        `/api/assets/${assetId}/contributions/${contributionId}`,
        {
          ...rest,
        }
      );
    },
    onSuccess: () => {
      invalidateAccounts();
      toast({
        title: "Contribution updated",
        description: "Your contribution has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteAssetContribution = useMutation<
    void,
    Error,
    {
      assetId: UserAsset["id"];
      contributionId: AssetTransaction["id"];
    }
  >({
    mutationFn: ({ assetId, contributionId }) =>
      apiRequest(
        "DELETE",
        `/api/assets/${assetId}/contributions/${contributionId}`
      ),
    onSuccess: () => {
      invalidateAccounts();
      toast({
        title: "Contribution deleted",
        description: "Your contribution has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Update milestone mutations to handle response data
  const addMilestone = useMutation<Milestone, Error, MilestoneOrphanInsert>({
    mutationFn: async (newMilestone) => {
      if (!user?.account.id) {
        throw new Error("User account ID is required");
      }

      const processedMilestone: MilestoneInsert = {
        ...newMilestone,
        userAccountId: user.account.id,
        accountType:
          newMilestone.accountType === "ALL"
            ? null
            : (newMilestone.accountType as AccountType),
      };
      return apiRequest<Milestone>(
        "POST",
        "/api/milestones",
        processedMilestone
      );
    },
    onSuccess: () => {
      invalidateMilestones();
      toast({
        title: "Milestone added",
        description: "Your investment milestone has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding milestone",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteMilestone = useMutation<void, Error, Milestone["id"]>({
    mutationFn: async (id) => {
      return apiRequest("DELETE", `/api/milestones/${id}`);
    },
    onSuccess: () => {
      invalidateMilestones();
      toast({
        title: "Milestone deleted",
        description: "Your investment milestone has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting milestone",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateMilestone = useMutation<Milestone, Error, MilestoneUpdate>({
    mutationFn: async (data) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/milestones/${id}`, data);
    },
    onSuccess: () => {
      invalidateMilestones();
      toast({
        title: "Success",
        description: "Milestone updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update milestone: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const createFireSettings = useMutation<
    FireSettings,
    Error,
    FireSettingsOrphan
  >({
    mutationFn: (settings) => {
      if (!user?.account.id) {
        throw new Error("User account ID is required");
      }
      const processedSettings: FireSettingsInsert = {
        ...settings,
        userAccountId: user.account.id,
      };

      return apiRequest("POST", "/api/fire-settings", processedSettings);
    },
    onSuccess: () => {
      invalidateFireSettings();
      toast({
        title: "FIRE settings created",
        description:
          "Your retirement planning settings have been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating FIRE settings",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateFireSettings = useMutation<
    FireSettings,
    Error,
    FireSettingsOrphan
  >({
    mutationFn: (settings) =>
      apiRequest("PATCH", "/api/fire-settings", settings),
    onSuccess: () => {
      invalidateFireSettings();
      toast({
        title: "FIRE settings updated",
        description:
          "Your retirement planning settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating FIRE settings",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Check for errors and show notifications
  useEffect(() => {
    if (isAssetsError) {
      toast({
        title: "Failed to load assets",
        description:
          "There was an error loading your assets. Please try again.",
        variant: "destructive",
      });
    }

    if (isMilestonesError) {
      toast({
        title: "Failed to load milestones",
        description:
          "There was an error loading your investment milestones. Please try again.",
        variant: "destructive",
      });
    }

    if (isFireSettingsError) {
      toast({
        title: "Failed to load FIRE settings",
        description:
          "There was an error loading your retirement settings. Please try again.",
        variant: "destructive",
      });
    }
  }, [isAssetsError, isMilestonesError, isFireSettingsError]);

  const isLoading =
    isLoadingAssets ||
    isLoadingMilestones ||
    isLoadingFireSettings ||
    isLoadingPortfolioOverview;

  return {
    ...context,
    addAsset,
    updateAsset,
    deleteAsset,
    addAssetValue,
    updateAssetValue,
    deleteAssetValue,
    addAssetContribution,
    updateAssetContribution,
    deleteAssetContribution,
    connectAssetApi,
    addMilestone,
    deleteMilestone,
    updateMilestone,
    updateFireSettings,
    createFireSettings,
    isLoading,
    assets,
    milestones,
    fireSettings,
    portfolioOverview,
  };
};
