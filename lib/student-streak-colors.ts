export const STREAK_COLOR_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 1000] as const;

export type StudentStreakColorTier =
  | "starter"
  | "ember"
  | "amber"
  | "lime"
  | "emerald"
  | "cyan"
  | "blue"
  | "violet"
  | "rose"
  | "gold";

const STREAK_COLOR_TIERS: Array<{
  min: number;
  tier: StudentStreakColorTier;
}> = [
  { min: 0, tier: "starter" },
  { min: 10, tier: "ember" },
  { min: 25, tier: "amber" },
  { min: 50, tier: "lime" },
  { min: 100, tier: "emerald" },
  { min: 150, tier: "cyan" },
  { min: 200, tier: "blue" },
  { min: 300, tier: "violet" },
  { min: 500, tier: "rose" },
  { min: 1000, tier: "gold" }
];

export function getStudentStreakColorMeta(currentStreak: number) {
  const normalizedStreak = Math.max(0, Math.floor(currentStreak));
  const currentTier =
    [...STREAK_COLOR_TIERS].reverse().find((entry) => normalizedStreak >= entry.min) ?? STREAK_COLOR_TIERS[0]!;
  const currentThreshold = currentTier.min > 0 ? currentTier.min : null;
  const nextThreshold = STREAK_COLOR_MILESTONES.find((threshold) => normalizedStreak < threshold) ?? null;

  return {
    tier: currentTier.tier,
    currentThreshold,
    nextThreshold,
    daysToNextThreshold: nextThreshold ? nextThreshold - normalizedStreak : null
  };
}
