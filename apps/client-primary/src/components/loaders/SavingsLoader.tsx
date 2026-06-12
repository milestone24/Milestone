const sizes = {
  sm: 24,
  md: 48,
  lg: 72,
};

interface SavingsLoaderProps {
  size?: keyof typeof sizes;
}

export function SavingsLoader({ size = "md" }: SavingsLoaderProps) {
  const px = sizes[size];

  return (
    <svg
      viewBox="0 0 48 48"
      width={px}
      height={px}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loading"
      role="status"
    >
      <style>{`
        @keyframes grow {
          0%, 100% { transform: scaleY(0.15); opacity: 0.25; }
          50%       { transform: scaleY(1);    opacity: 1;    }
        }
        .bar {
          transform-box: fill-box;
          transform-origin: bottom;
          animation: grow 1.5s ease-in-out infinite;
          fill: var(--primary);
        }
        .bar-1 { animation-delay: 0s;   }
        .bar-2 { animation-delay: 0.2s; }
        .bar-3 { animation-delay: 0.4s; }
      `}</style>

      <rect className="bar bar-1" x="6"    y="8" width="9" height="32" rx="2" />
      <rect className="bar bar-2" x="19.5" y="8" width="9" height="32" rx="2" />
      <rect className="bar bar-3" x="33"   y="8" width="9" height="32" rx="2" />
    </svg>
  );
}
