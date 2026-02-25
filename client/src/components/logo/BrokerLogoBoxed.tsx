import { BrokerLogo, BrokerLogoProps } from "./BrokerLogo";

type BrokerLogoBoxedProps = BrokerLogoProps;

export default function BrokerLogoBoxed({
  broker,
  size,
}: BrokerLogoBoxedProps) {
  return (
    <div className="w-32 h-32 bg-muted rounded-md flex items-center justify-center p-2">
      <BrokerLogo broker={broker} size={size} />
    </div>
  );
}
