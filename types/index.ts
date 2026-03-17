export type ConditionState = 'Stable' | 'Strained' | 'Fractured' | 'Destabilized';

export const SIZE_CLASSES = ['Compact', 'Standard', 'Heavy'] as const;
export const MOBILITIES = ['Agile', 'Balanced', 'Grounded'] as const;
export const COMBAT_STYLES = ['Aggressive', 'Tactical', 'Defensive'] as const;
export const WEAKNESSES = ['Energy Vulnerable', 'Physical Vulnerable', 'Low Mobility', 'Fragile Structure'] as const;

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

export interface AbilityTemplate {
  id: string;
  name: string;
  category: 'basic' | 'special' | 'defense' | 'passive' | 'weakness';
  description: string;
  fpCost?: number;
}

export interface CypherKit {
  basicAttack: string;
  special1: string;
  special2: string;
  defense: string;
  passive: string;
  weakness: string;
}

export interface FPAllocation {
  attack: number;
  defense: number;
  mobility: number;
  stability: number;
}

export interface Cypher {
  id: string;
  name: string;
  originLog?: string;
  description: string;

  // Structure
  sizeClass: string;
  mobility: string;
  combatStyle: string;

  // Kit
  kit: CypherKit;

  // Stats (optional for pre-existing cyphers)
  stats?: CypherStats;
  bonusAllocation?: BonusAllocation;

  // State
  conditionState: ConditionState;
  fpAllocated: number;
  fpAllocation: FPAllocation;

  // Assets
  imageUrl?: string;
  portraitImage?: string;
  battlePoseImage?: string;

  // Metadata
  createdAt: string;
  isActive: boolean;
}

export interface GenesisWizardDraft {
  step: number;
  sketchData?: string;
  visualDescription?: string;
  selectedImageUrl?: string;
  name: string;
  originLog?: string;
  sizeClass?: string;
  mobility?: string;
  combatStyle?: string;
  kit?: Partial<CypherKit>;
  description?: string;
  bonusAllocation?: BonusAllocation;
}

export interface BattleEvent {
  timestamp: number;
  cypherId: string;
  cypherName: string;
  action: string;
  newCondition?: ConditionState;
}

export interface BattleResult {
  battleId: string;
  timestamp: string;
  participants: string[];
  events: BattleEvent[];
  winner?: string;
}
