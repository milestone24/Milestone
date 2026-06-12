import InvestEngine from "./InvestEngine";
import { twMerge } from "tailwind-merge";
import Vanguard from "./Vanguard";
import { TrendingUp } from "lucide-react";

export const DefaultBrokerLogo = () => {
  return (
    <TrendingUp
      className="w-full h-full text-muted-foreground"
      strokeWidth={1}
      size={24}
    />
  );
};

export type BrokerLogoProps = {
  broker?: string;
  size?: "sm" | "md" | "lg";
};

export const BrokerLogo = ({ broker, size = "sm" }: BrokerLogoProps) => {
  const wrapperClasses = twMerge(
    "flex items-center justify-center",
    size === "sm" && "w-10 h-10",
    size === "md" && "w-24 h-24",
    size === "lg" && "w-32 h-32"
  );

  return (
    <div className={wrapperClasses}>
      {broker === "invest-engine" ? (
        <InvestEngine />
      ) : broker === "vanguard" ? (
        <Vanguard />
      ) : (
        <DefaultBrokerLogo />
      )}
    </div>
  );
};
