import { useCallback, useEffect, useMemo, useState } from "react";
import { accountType, createDecimalValueString } from "../../schema";
import type { AccountType, DecimalValueString } from "../../schema";
import type { Contributor, ContributionTypes } from "../../schema/projections";
import { contributionTypes } from "../../schema/projections";
import Decimal from "decimal.js";
import { defineContributorRulesForAssetType } from "../../utils/projection-utils-contributor";
import { useStorage } from "../../platform/PlatformServicesProvider";

const CUSTOM_CONTRIBUTORS_KEY = "fire-standalone-contributors";

const isAccountType = (value: unknown): value is AccountType =>
  typeof value === "string" &&
  (accountType as readonly string[]).includes(value);

const isContributionType = (value: unknown): value is ContributionTypes =>
  typeof value === "string" &&
  (contributionTypes as readonly string[]).includes(value);

const totalContributorMontly = (contributor: Contributor) => {
  return contributor.schedules.reduce(
    (scheduleTotal: number, schedule) =>
      scheduleTotal + Decimal(schedule.value).toNumber(),
    0
  );
};

const totalContributorsMonthly = (contributors: Contributor[]) => {
  return contributors.reduce(
    (total: number, contributor) =>
      total + totalContributorMontly(contributor),
    0
  );
};

const parseStoredContributors = (raw: string | null): Contributor[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Contributor =>
        typeof item === "object" &&
        item !== null &&
        typeof item.name === "string" &&
        isAccountType(item.accountType) &&
        isContributionType(item.type)
    );
  } catch (error) {
    console.warn("Failed to parse stored standalone contributors", error);
    return [];
  }
};

const generateId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `contrib_${Math.random().toString(36).slice(2, 10)}`;
};

export function useStandaloneContributors() {
  const storage = useStorage();
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const raw = await storage.getItem(CUSTOM_CONTRIBUTORS_KEY);
      if (cancelled) return;
      setContributors(parseStoredContributors(raw));
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!isHydrated) return;
    void storage.setItem(
      CUSTOM_CONTRIBUTORS_KEY,
      JSON.stringify(contributors)
    );
  }, [contributors, isHydrated, storage]);

  const addContributor = useCallback((input: Omit<Contributor, "id">) => {
    setContributors((prev) => [
      ...prev,
      {
        ...input,
        id: generateId(),
        ...(input.accountType !== null
          ? defineContributorRulesForAssetType(input.accountType)
          : {}),
      },
    ]);
  }, []);

  const updateContributor = useCallback(
    (id: string, updates: Partial<Omit<Contributor, "id">>) => {
      setContributors((prev) =>
        prev.map((contributor) =>
          contributor.id === id ? { ...contributor, ...updates } : contributor
        )
      );
    },
    []
  );

  const removeContributor = useCallback((id: string) => {
    setContributors((prev) =>
      prev.filter((contributor) => contributor.id !== id)
    );
  }, []);

  const resetContributors = useCallback(() => {
    setContributors([]);
  }, []);

  const totalMonthlyAmount: DecimalValueString = useMemo(() => {
    return createDecimalValueString(
      totalContributorsMonthly(contributors).toString()
    );
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
