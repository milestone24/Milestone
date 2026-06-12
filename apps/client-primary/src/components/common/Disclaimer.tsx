type DisclaimerProps = {
  className?: string;
};

export function Disclaimer({ className }: DisclaimerProps) {
  return (
    <p
      className={
        className ??
        "mt-3 text-center text-xs leading-relaxed text-muted-foreground"
      }
    >
      These figures are for illustrative purposes only and do not constitute
      financial advice.
      <br />
      Past performance does not guarantee future results.
    </p>
  );
}

