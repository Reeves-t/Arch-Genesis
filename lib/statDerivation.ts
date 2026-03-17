// lib/statDerivation.ts
// Reference: docs/CYPHER_SYSTEM.md

export interface CypherStats {
  movement_speed: number;
  attack_range: number;
  melee_power: number;
  defense_rating: number;
  special_range: number;
  initiative: number;
}

export interface BonusAllocation {
  movement_speed: number;
  attack_range: number;
  melee_power: number;
  defense_rating: number;
  special_range: number;
  initiative: number;
}

export const STAT_CAPS = {
  movement_speed: 8,
  attack_range: 8,
  melee_power: 10,
  defense_rating: 10,
  special_range: 8,
  initiative: 10,
};

export const TOTAL_BONUS_POINTS = 6;
export const MAX_BONUS_PER_STAT = 2;

// ─── Custom Input Mapping ─────────────────────────────────────────────────────

function mapToStandardSize(size: string): string {
  const s = size.toLowerCase();
  if (['tiny', 'micro', 'small', 'little', 'miniature', 'compact', 'mini'].some((k) => s.includes(k))) return 'Compact';
  if (['huge', 'giant', 'colossal', 'massive', 'large', 'enormous', 'big'].some((k) => s.includes(k))) return 'Heavy';
  return 'Standard';
}

function mapToStandardMobility(mobility: string): string {
  const s = mobility.toLowerCase();
  if (['fast', 'quick', 'swift', 'agile', 'speed', 'dash', 'phase', 'quantum', 'flash', 'rapid'].some((k) => s.includes(k))) return 'Agile';
  if (['slow', 'heavy', 'lumbering', 'plodding', 'deliberate', 'grounded', 'steady'].some((k) => s.includes(k))) return 'Grounded';
  return 'Balanced';
}

function mapToStandardCombat(combat: string): string {
  const s = combat.toLowerCase();
  if (['aggressive', 'attack', 'offense', 'berserker', 'assault', 'rush', 'ambush'].some((k) => s.includes(k))) return 'Aggressive';
  if (['defensive', 'defense', 'protect', 'guard', 'fortress', 'shield', 'tank'].some((k) => s.includes(k))) return 'Defensive';
  return 'Tactical';
}

export function mapCustomStructureToStandard(
  size: string,
  mobility: string,
  combatStyle: string
): { size: string; mobility: string; combatStyle: string } {
  return {
    size: mapToStandardSize(size),
    mobility: mapToStandardMobility(mobility),
    combatStyle: mapToStandardCombat(combatStyle),
  };
}

// ─── Stat Derivation Helpers ──────────────────────────────────────────────────

function deriveMovementSpeed(mobility: string, size: string): number {
  if (mobility === 'Agile' && size === 'Compact') return 6;
  if (mobility === 'Agile' && size === 'Standard') return 5;
  if (mobility === 'Agile' && size === 'Heavy') return 4;
  if (mobility === 'Balanced' && size === 'Compact') return 4;
  if (mobility === 'Balanced' && size === 'Standard') return 3;
  if (mobility === 'Balanced' && size === 'Heavy') return 3;
  if (mobility === 'Grounded' && size === 'Compact') return 3;
  if (mobility === 'Grounded' && size === 'Standard') return 2;
  if (mobility === 'Grounded' && size === 'Heavy') return 2;
  return 3;
}

function deriveAttackRange(combat: string): number {
  if (combat === 'Aggressive') return 1;
  if (combat === 'Tactical') return 4;
  if (combat === 'Defensive') return 6;
  return 4;
}

function deriveMeleePower(size: string): number {
  if (size === 'Compact') return 4;
  if (size === 'Standard') return 6;
  if (size === 'Heavy') return 8;
  return 6;
}

function deriveDefenseRating(combat: string): number {
  if (combat === 'Aggressive') return 3;
  if (combat === 'Tactical') return 5;
  if (combat === 'Defensive') return 7;
  return 5;
}

function deriveSpecialRange(abilities: string[], movementSpeed: number): number {
  const text = abilities.join(' ').toLowerCase();
  const meleeKeywords = ['strike', 'slam', 'punch', 'claw', 'cut'];
  const burstKeywords = ['pulse', 'wave', 'aura', 'burst', 'explode'];
  const beamKeywords = ['beam', 'blast', 'shot', 'ranged', 'projectile', 'fire'];
  const moveKeywords = ['teleport', 'dash', 'charge', 'phase'];

  if (meleeKeywords.some((k) => text.includes(k))) return 1;
  if (burstKeywords.some((k) => text.includes(k))) return 3;
  if (beamKeywords.some((k) => text.includes(k))) return 5;
  if (moveKeywords.some((k) => text.includes(k))) return movementSpeed;
  return 3;
}

function deriveInitiative(mobility: string, size: string): number {
  if (mobility === 'Agile' && size === 'Compact') return 8;
  if (mobility === 'Agile' && size === 'Standard') return 7;
  if (mobility === 'Agile' && size === 'Heavy') return 6;
  if (mobility === 'Balanced' && size === 'Compact') return 6;
  if (mobility === 'Balanced' && size === 'Standard') return 5;
  if (mobility === 'Balanced' && size === 'Heavy') return 4;
  if (mobility === 'Grounded' && size === 'Compact') return 4;
  if (mobility === 'Grounded' && size === 'Standard') return 3;
  if (mobility === 'Grounded' && size === 'Heavy') return 2;
  return 5;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function deriveBaseStats(
  size: string,
  mobility: string,
  combatStyle: string,
  abilities: string[]
): CypherStats {
  const mappedSize = mapToStandardSize(size);
  const mappedMobility = mapToStandardMobility(mobility);
  const mappedCombat = mapToStandardCombat(combatStyle);
  const speed = deriveMovementSpeed(mappedMobility, mappedSize);

  return {
    movement_speed: speed,
    attack_range: deriveAttackRange(mappedCombat),
    melee_power: deriveMeleePower(mappedSize),
    defense_rating: deriveDefenseRating(mappedCombat),
    special_range: deriveSpecialRange(abilities, speed),
    initiative: deriveInitiative(mappedMobility, mappedSize),
  };
}

export function applyBonusPoints(
  baseStats: CypherStats,
  bonus: BonusAllocation
): CypherStats {
  return {
    movement_speed: Math.min(baseStats.movement_speed + bonus.movement_speed, STAT_CAPS.movement_speed),
    attack_range: Math.min(baseStats.attack_range + bonus.attack_range, STAT_CAPS.attack_range),
    melee_power: Math.min(baseStats.melee_power + bonus.melee_power, STAT_CAPS.melee_power),
    defense_rating: Math.min(baseStats.defense_rating + bonus.defense_rating, STAT_CAPS.defense_rating),
    special_range: Math.min(baseStats.special_range + bonus.special_range, STAT_CAPS.special_range),
    initiative: Math.min(baseStats.initiative + bonus.initiative, STAT_CAPS.initiative),
  };
}
