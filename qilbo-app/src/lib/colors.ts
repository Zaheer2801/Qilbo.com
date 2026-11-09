// QILBO DESIGN SYSTEM: CATEGORY COLORS, BRAND SHADES & DISTRIBUTOR BADGES
// =====================================================================

export const CATEGORY_COLORS: Record<string, { hex: string; bg: string; text: string; border: string; dot: string; label: string }> = {
  // 7 Groups
  "Spirits": {
    hex: "#8B5CF6",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
    label: "Spirits"
  },
  "Beer & RTD": {
    hex: "#EAB308",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
    label: "Beer & RTD"
  },
  "Wine": {
    hex: "#DB2777",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
    dot: "bg-pink-600",
    label: "Wine"
  },
  "Drinks & Mixers": {
    hex: "#6366F1",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    dot: "bg-indigo-500",
    label: "Drinks & Mixers"
  },
  "Snacks & Grocery": {
    hex: "#84CC16",
    bg: "bg-lime-50 dark:bg-lime-950/40",
    text: "text-lime-800 dark:text-lime-300",
    border: "border-lime-200 dark:border-lime-800",
    dot: "bg-lime-600",
    label: "Snacks & Grocery"
  },
  "Tobacco": {
    hex: "#64748B",
    bg: "bg-slate-100 dark:bg-slate-900/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
    label: "Tobacco"
  },
  "Lottery": {
    hex: "#9CA3AF",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
    dot: "bg-gray-400",
    label: "Lottery"
  },

  // Sub-categories
  "Vodka": {
    hex: "#3B82F6",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    label: "Vodka"
  },
  "Tequila/Mezcal": {
    hex: "#F97316",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
    label: "Tequila / Mezcal"
  },
  "Whiskey": {
    hex: "#92400E",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
    dot: "bg-[#92400E]",
    label: "Whiskey"
  },
  "Whiskey/Bourbon/Scotch": {
    hex: "#92400E",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
    dot: "bg-[#92400E]",
    label: "Whiskey / Bourbon"
  },
  "Cognac/Brandy": {
    hex: "#BE123C",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-[#BE123C]",
    label: "Cognac / Brandy"
  },
  "Rum": {
    hex: "#0D9488",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
    dot: "bg-teal-600",
    label: "Rum"
  },
  "Gin": {
    hex: "#16A34A",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-600",
    label: "Gin"
  },
  "Liqueur": {
    hex: "#9333EA",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-600",
    label: "Liqueur"
  },
  "Liqueur/Cordials": {
    hex: "#9333EA",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-600",
    label: "Liqueur"
  },
  "Other Spirits – review": {
    hex: "#A855F7",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
    label: "Other Spirits – review"
  },
  "Beer": {
    hex: "#EAB308",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-800",
    dot: "bg-yellow-500",
    label: "Beer"
  },
  "Beer/Malt": {
    hex: "#EAB308",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-800",
    dot: "bg-yellow-500",
    label: "Beer / Malt"
  },
  "RTD/Seltzer": {
    hex: "#06B6D4",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
    dot: "bg-cyan-500",
    label: "RTD / Seltzer"
  },
  "Cigarettes": {
    hex: "#64748B",
    bg: "bg-slate-100 dark:bg-slate-900/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
    label: "Cigarettes"
  },
  "Cigars/Cigarillos": {
    hex: "#78716C",
    bg: "bg-stone-100 dark:bg-stone-900/60",
    text: "text-stone-700 dark:text-stone-300",
    border: "border-stone-300 dark:border-stone-700",
    dot: "bg-stone-500",
    label: "Cigars / Cigarillos"
  },
  "Vapes": {
    hex: "#0EA5E9",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
    dot: "bg-sky-500",
    label: "Vapes"
  },
  "Accessories": {
    hex: "#6B7280",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-300 dark:border-gray-700",
    dot: "bg-gray-500",
    label: "Accessories"
  },
  "Grocery/Other": {
    hex: "#84CC16",
    bg: "bg-lime-50 dark:bg-lime-950/40",
    text: "text-lime-800 dark:text-lime-300",
    border: "border-lime-200 dark:border-lime-800",
    dot: "bg-lime-600",
    label: "Grocery / Other"
  }
};

export function getCategoryConfig(category?: string | null) {
  if (!category) return CATEGORY_COLORS["Grocery/Other"];
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  // Fuzzy match
  const lower = category.toLowerCase();
  for (const [key, conf] of Object.entries(CATEGORY_COLORS)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return conf;
    }
  }
  return {
    hex: "#6B7280",
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-500",
    label: category
  };
}

// Deterministic brand shade generator (based on hash of brand name)
export function getBrandChipStyle(category?: string | null, brand?: string | null): {
  bg: string;
  text: string;
  border: string;
  accent: string;
} {
  const cat = getCategoryConfig(category);
  if (!brand || brand === "Unknown") {
    return {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-700",
      accent: "#94A3B8"
    };
  }

  // Hash the brand string to select tint
  let hash = 0;
  for (let i = 0; i < brand.length; i++) {
    hash = (hash << 5) - hash + brand.charCodeAt(i);
    hash |= 0;
  }

  // Return style tailored to category
  return {
    bg: cat.bg,
    text: cat.text,
    border: cat.border,
    accent: cat.hex
  };
}

// Brand initials for the icon square (e.g. "Don Julio" -> "DJ", "Hennessy" -> "H")
export function getBrandInitials(brand?: string | null, name?: string): string {
  const target = brand || name || "";
  const words = target.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words[0]?.[0]?.toUpperCase() || "DL";
}

// DISTRIBUTOR BADGE STYLING
export function getDistributorBadge(distributor?: string | null): {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  if (!distributor) {
    return {
      label: "Unknown",
      bg: "bg-slate-100 dark:bg-slate-800/60",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-700",
      dot: "bg-slate-400"
    };
  }
  const d = distributor.toLowerCase();
  if (d.includes("breakthru")) {
    return {
      label: "Breakthru",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      dot: "bg-indigo-600"
    };
  }
  if (d.includes("southern") || d.includes("glazer")) {
    return {
      label: "Southern Glazer's",
      bg: "bg-red-50 dark:bg-red-950/40",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-200 dark:border-red-800",
      dot: "bg-red-600"
    };
  }
  if (d.includes("gold coast")) {
    return {
      label: "Gold Coast",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-300 dark:border-amber-800",
      dot: "bg-amber-500"
    };
  }
  if (d.includes("florida")) {
    return {
      label: "Florida Distributors",
      bg: "bg-sky-50 dark:bg-sky-950/40",
      text: "text-sky-700 dark:text-sky-300",
      border: "border-sky-200 dark:border-sky-800",
      dot: "bg-sky-500"
    };
  }
  if (d.includes("wayne densch") || d.includes("densch") || d.includes("wdi")) {
    return {
      label: "Wayne Densch",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-600"
    };
  }
  return {
    label: distributor,
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400"
  };
}

// Sales performance tier gauge helper
export function getPerformanceTier(perWeek: number): {
  tier: "Excellent" | "Good" | "Slow";
  color: string;
  gaugePct: number;
} {
  if (perWeek >= 5.0) {
    return { tier: "Excellent", color: "text-emerald-600", gaugePct: 95 };
  }
  if (perWeek >= 1.0) {
    return { tier: "Good", color: "text-blue-600", gaugePct: 65 };
  }
  return { tier: "Slow", color: "text-amber-500", gaugePct: 25 };
}
