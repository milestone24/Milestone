import { useCallback, useEffect, useMemo, useState } from "react";
import { accountType, createDecimalValueString } from "@shared/schema";
import type { AccountType } from "@shared/schema";
import type { Contributor, ContributionTypes } from "@shared/schema/projections";
import { contributionTypes } from "@shared/schema/projections";

export type ContributionMode = "portfolio" | "custom";

export type StandaloneContributor = {
  id: string;
  name: string;
  accountType: AccountType;
  type: ContributionTypes;
  monthlyAmount: number;
};

const CONTRIBUTION_MODE_KEY = "fire-contribution-mode";
const CUSTOM_CONTRIBUTORS_KEY = "fire-standalone-contributors";

const getWindow = () => (typeof window === "undefined" ? null : window);

const isAccountType = (value: unknown): value is AccountType =>
  typeof value === "string" && (accountType as readonly string[]).includes(value);

const isContributionType = (value: unknown): value is ContributionTypes =>
  typeof value === "string" && (contributionTypes as readonly string[]).includes(value);

const parseStoredContributors = (): StandaloneContributor[] => {
  const win = getWindow();
  if (!win) return [];

  try {
    const raw = win.localStorage.getItem(CUSTOM_CONTRIBUTORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StandaloneContributor =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        isAccountType(item.accountType) &&
        isContributionType(item.type) &&
        typeof item.monthlyAmount === "number",
    ) as StandaloneContributor[];
  } catch (error) {
    console.warn("Failed to parse stored standalone contributors", error);
    return [];
  }
};

const parseStoredMode = (): ContributionMode => {
  const win = getWindow();
  if (!win) return "portfolio";
  const stored = win.localStorage.getItem(CONTRIBUTION_MODE_KEY);
  return stored === "custom" ? "custom" : "portfolio";
};

const storeMode = (mode: ContributionMode) => {
  const win = getWindow();
  if (!win) return;
  win.localStorage.setItem(CONTRIBUTION_MODE_KEY, mode);
};

const storeContributors = (contributors: StandaloneContributor[]) => {
  const win = getWindow();
  if (!win) return;
  win.localStorage.setItem(CUSTOM_CONTRIBUTORS_KEY, JSON.stringify(contributors));
};

const generateId = () => {
  const win = getWindow();
  if (win?.crypto?.randomUUID) {
    return win.crypto.randomUUID();
  }
  return `contrib_${Math.random().toString(36).slice(2, 10)}`;
};

const defaultSchedule = () => ({
  patternConfig: {
    type: "cron" as const,
    expression: "0 0 1 * *", // first day of month
  },
  startDate: new Date(),
  endDate: null,
});

const mapStandaloneToContributor = (item: StandaloneContributor): Contributor => ({
  accountType: item.accountType,
  name: item.name,
  type: item.type,
  currentValue: createDecimalValueString("0"),
  schedules: [
    {
      ...defaultSchedule(),
      value: createDecimalValueString(item.monthlyAmount.toString()),
    },
  ],
});

export function useStandaloneContributors() {
  const [mode, setModeState] = useState<ContributionMode>(() => parseStoredMode());
  const [contributors, setContributors] = useState<StandaloneContributor[]>(() =>
    parseStoredContributors(),
  );

  useEffect(() => {
    storeMode(mode);
  }, [mode]);

  useEffect(() => {
    storeContributors(contributors);
  }, [contributors]);

  const setMode = useCallback((next: ContributionMode) => {
    setModeState(next);
  }, []);

  const addContributor = useCallback((input: Omit<StandaloneContributor, "id">) => {
    setContributors((prev) => [
      ...prev,
      {
        ...input,
        id: generateId(),
      },
    ]);
  }, []);

  const updateContributor = useCallback(
    (id: string, updates: Partial<Omit<StandaloneContributor, "id">>) => {
      setContributors((prev) =>
        prev.map((contributor) =>
          contributor.id === id ? { ...contributor, ...updates } : contributor,
        ),
      );
    },
    [],
  );

  const removeContributor = useCallback((id: string) => {
    setContributors((prev) => prev.filter((contributor) => contributor.id !== id));
  }, []);

  const resetContributors = useCallback(() => {
    setContributors([]);
  }, []);

  const mappedContributors = useMemo<Contributor[]>(() => {
    if (!contributors.length) return [];
    return contributors.map(mapStandaloneToContributor);
  }, [contributors]);

  const totalMonthlyAmount = useMemo(() => {
    return contributors.reduce((total, contributor) => total + contributor.monthlyAmount, 0);
  }, [contributors]);

  const hasCustomContributors = contributors.length > 0;

  return {
    mode,
    setMode,
    contributors,
    addContributor,
    updateContributor,
    removeContributor,
    resetContributors,
    mappedContributors,
    totalMonthlyAmount,
    hasCustomContributors,
  };
}

