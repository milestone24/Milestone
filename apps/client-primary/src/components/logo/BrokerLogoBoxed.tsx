import { BrokerLogo } from "./BrokerLogo";

type BrokerLogoBoxedSize = "sm" | "md" | "lg";

type BrokerLogoBoxedProps = {
  broker?: string;
  size?: BrokerLogoBoxedSize;
};

const containerSizeMap: Record<BrokerLogoBoxedSize, string> = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-20 h-20",
};

export default function BrokerLogoBoxed({
  broker,
  size = "md",
}: BrokerLogoBoxedProps) {
  return (
    <div
      className={`${containerSizeMap[size]} bg-muted rounded-md flex items-center justify-center p-2 shrink-0`}
    >
      <BrokerLogo broker={broker} size="sm" />
    </div>
  );
}
