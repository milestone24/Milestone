import { useCallback, useEffect, useMemo, useState } from "react";
import { accountType, createDecimalValueString } from "@shared/schema";
import type { AccountType, DecimalValueString } from "@shared/schema";
import type { Contributor, ContributionTypes } from "@shared/schema/projections";
import { contributionTypes } from "@shared/schema/projections";
import Decimal from "decimal.js";
import { defineContributorRulesForAssetType } from "@shared/utils/projection-utils-contributor";

const CUSTOM_CONTRIBUTORS_KEY = "fire-standalone-contributors";

const getWindow = () => (typeof window === "undefined" ? null : window);

const isAccountType = (value: unknown): value is AccountType =>
  typeof value === "string" && (accountType as readonly string[]).includes(value);

const isContributionType = (value: unknown): value is ContributionTypes =>
  typeof value === "string" && (contributionTypes as readonly string[]).includes(value);

const totalContributorMontly = (contributor: Contributor) => {
  return contributor.schedules.reduce((scheduleTotal: number, schedule) =>
    scheduleTotal + Decimal(schedule.value).toNumber(), 0);
};

const totalContributorsMonthly = (contributors: Contributor[]) => {
  return contributors.reduce((total: number, contributor) =>
    total + totalContributorMontly(contributor), 0);
};

//TODO Would this work in a React Native app?
const parseStoredContributors = (): Contributor[] => {

  const win = getWindow();
  if (!win) return [];

  try {
    const raw = win.localStorage.getItem(CUSTOM_CONTRIBUTORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter(
      (item): item is Contributor =>
        typeof item === "object" &&
        item !== null &&
        typeof item.name === "string" &&
        isAccountType(item.accountType) &&
        isContributionType(item.type)
    ) as Contributor[];
    return filtered;
  } catch (error) {
    console.warn("Failed to parse stored standalone contributors", error);
    return [];
  }
};

//TODO Would this work in a React Native app?
const storeContributors = (contributors: Contributor[]) => {
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

export function useStandaloneContributors() {
  const [contributors, setContributors] = useState<Contributor[]>(() =>
    parseStoredContributors(),
  );

  useEffect(() => {
    //TODO: Is doing this in a use Effect the correct way. Maybe causing to menay rerenders.
    storeContributors(contributors);
  }, [contributors]);

  const addContributor = useCallback((input: Omit<Contributor, "id">) => {
    setContributors((prev) => [
      ...prev,
      {
        ...input,
        id: generateId(),
        ...(input.accountType !== null ? defineContributorRulesForAssetType(input.accountType) : {}),
      },
    ]);
  }, []);

  const updateContributor = useCallback(
    (id: string, updates: Partial<Omit<Contributor, "id">>) => {
      setContributors((prev) =>
        prev.map((contributor) =>
          contributor.id === id ? { ...contributor, ...updates } : contributor,
        ),
      );
    },
    [],
  );

  const removeContributor = useCallback((id: string) => {

    console.log("contributors : ", contributors);
    console.log("removeContributor : ", id);

    setContributors((prev) => prev.filter((contributor) => contributor.id !== id));
  }, []);

  const resetContributors = useCallback(() => {
    setContributors([]);
  }, []);

  const totalMonthlyAmount: DecimalValueString = useMemo(() => {
    return createDecimalValueString(totalContributorsMonthly(contributors).toString());
  }, [contributors]);

  const hasCustomContributors = contributors.length > 0;

  return {
    contributors,
    addContributor,
    updateContributor,
    removeContributor,
    resetContributors,
    totalMonthlyAmount,
    hasCustomContributors,
  };
}

