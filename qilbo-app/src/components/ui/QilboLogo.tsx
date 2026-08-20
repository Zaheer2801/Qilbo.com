import React from "react";

interface QilboLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  layout?: "horizontal" | "stacked" | "icon";
}

export const QilboLogo: React.FC<QilboLogoProps> = ({
  className = "",
  size = "md",
  showTagline = true,
  layout = "horizontal",
}) => {
  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
    xl: "w-20 h-20",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-5xl",
  };

  const taglineSizes = {
    sm: "text-[9px]",
    md: "text-[11px]",
    lg: "text-[13px]",
    xl: "text-[15px]",
  };

  const IconSVG = (
    <div className={`relative flex items-center justify-center shrink-0 ${iconSizes[size]}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(255,110,0,0.4)]"
      >
        <defs>
          <linearGradient id="qilboGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFA800" />
            <stop offset="45%" stopColor="#FF5E00" />
            <stop offset="100%" stopColor="#FF2A00" />
          </linearGradient>
          <linearGradient id="bagGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD000" />
            <stop offset="100%" stopColor="#FF6000" />
          </linearGradient>
        </defs>
        
        {/* Outer Q Swoosh Curve */}
        <path
          d="M 50 8 A 42 42 0 1 0 85 75 L 92 88 C 94 92 90 95 86 92 L 68 80 A 42 42 0 0 0 50 8 Z"
          fill="url(#qilboGradient)"
        />

        {/* Inner Cutout */}
        <ellipse cx="48" cy="46" rx="28" ry="28" fill="#0A0D14" />

        {/* Shopping Bag inside Q */}
        <path
          d="M 38 42 H 62 C 64 42 65 44 64.5 46 L 61 72 C 60.5 74 59 75 57 75 H 43 C 41 75 39.5 74 39 72 L 35.5 46 C 35 44 36 42 38 42 Z"
          fill="url(#bagGradient)"
        />
        {/* Handle */}
        <path
          d="M 44 42 V 36 C 44 33 46.5 30 50 30 C 53.5 30 56 33 56 36 V 42"
          stroke="url(#bagGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Bag detail lines */}
        <line x1="43" y1="52" x2="57" y2="52" stroke="#0A0D14" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="45" y1="58" x2="53" y2="58" stroke="#0A0D14" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );

  if (layout === "icon") {
    return <div className={className}>{IconSVG}</div>;
  }

  if (layout === "stacked") {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {IconSVG}
        <div className="mt-2 flex flex-col items-center">
          <span className={`font-bold tracking-tight text-white ${textSizes[size]}`}>
            Qilbo
          </span>
          {showTagline && (
            <span
              className={`font-semibold uppercase tracking-[0.18em] text-amber-500/90 ${taglineSizes[size]}`}
            >
              Point-of-Sale for Independent Retailers
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {IconSVG}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className={`font-extrabold tracking-tight text-white ${textSizes[size]}`}>
            Qilbo
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse"></span>
        </div>
        {showTagline && (
          <span
            className={`font-semibold uppercase tracking-[0.14em] text-amber-500/90 ${taglineSizes[size]}`}
          >
            POS & Inventory Intelligence
          </span>
        )}
      </div>
    </div>
  );
};
