/** Build tiers. v1 is open to every signed-in user; v2 and v3 are not released yet. */
export type ModelTier = 'v1' | 'v2' | 'v3';

export const AVAILABLE_TIERS: readonly ModelTier[] = ['v1'];

export interface TierCheck {
  tier: ModelTier;
  eligible: boolean;
  message?: string;
}

const TIER_NAMES: Record<ModelTier, string> = {
  v1: 'VocaWeb v1',
  v2: 'VocaWeb v2',
  v3: 'VocaWeb v3',
};

/** Falls back to v1 for a missing or unknown value, and refuses tiers that are not open. */
export function checkTier(requested: unknown): TierCheck {
  const tier: ModelTier =
    requested === 'v2' || requested === 'v3' || requested === 'v1' ? requested : 'v1';

  if (AVAILABLE_TIERS.includes(tier)) return { tier, eligible: true };

  return {
    tier,
    eligible: false,
    message: `${TIER_NAMES[tier]} is not available yet. Use ${TIER_NAMES.v1} for now.`,
  };
}
