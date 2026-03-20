import { create } from 'zustand';
import { Cypher, GenesisWizardDraft, BattleResult, BonusAllocation } from '../types';
import { supabase } from '../lib/supabase';

interface GameStore {
  roster: Cypher[];
  primaryCypherId: string | null;
  genesisWizard: GenesisWizardDraft;
  battles: BattleResult[];

  // Actions
  setPrimaryCypher: (id: string) => void;
  createCypher: (cypher: Cypher) => void;
  updateCypher: (id: string, updates: Partial<Cypher>) => void;
  deleteCypher: (id: string) => void;

  // Genesis Wizard
  updateWizardStep: (step: number, data: Partial<GenesisWizardDraft>) => void;
  resetWizard: () => void;
  autoStructure: () => void;

  // Battles
  addBattle: (battle: BattleResult) => void;

  // Persistence
  loadUserCyphers: (userId: string) => Promise<void>;

  // Active roster management
  setActive: (id: string, isActive: boolean) => void;
  getActiveRoster: () => Cypher[];
}

const EMPTY_BONUS: BonusAllocation = {
  movement_speed: 0,
  attack_range: 0,
  melee_power: 0,
  defense_rating: 0,
  special_range: 0,
  initiative: 0,
};

const INITIAL_WIZARD: GenesisWizardDraft = {
  step: 1,
  name: '',
  bonusAllocation: { ...EMPTY_BONUS },
};

// Seed data
const SEED_CYPHERS: Cypher[] = [
  {
    id: 'seed-1',
    name: 'Nexus-7',
    originLog: 'Emerged from a recursive data stream during Framework initialization.',
    description: 'A tactical crystalline entity that absorbs and redirects energy. Fights with calculated precision — opens with Pulse barrages, reads opponent patterns, then strikes with devastating Overloads at the perfect moment. Prefers to outlast opponents through superior defense and adaptive countermeasures. Cold, methodical, and relentless.',
    sizeClass: 'Standard',
    mobility: 'Balanced',
    combatStyle: 'Tactical',
    kit: {
      basicAttack: 'Pulse',
      special1: 'Overload',
      special2: 'Amplify',
      defense: 'Barrier',
      passive: 'Adaptive',
      weakness: 'Energy Vulnerable',
    },
    conditionState: 'Stable',
    fpAllocated: 12,
    fpAllocation: { attack: 3, defense: 4, mobility: 3, stability: 2 },
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'seed-2',
    name: 'Vortex',
    originLog: 'Spontaneous manifestation in the outer Framework layers.',
    description: 'A volatile, fast-moving phantom that overwhelms opponents with relentless aggression. Fights like a storm — chains Burst attacks into Cascades, creating openings to Disrupt enemy defenses. Uses momentum-based combat, getting stronger the longer a fight goes. Reckless and unpredictable, but fragile if caught off-guard.',
    sizeClass: 'Compact',
    mobility: 'Agile',
    combatStyle: 'Aggressive',
    kit: {
      basicAttack: 'Burst',
      special1: 'Cascade',
      special2: 'Disrupt',
      defense: 'Evade',
      passive: 'Momentum',
      weakness: 'Physical Vulnerable',
    },
    conditionState: 'Stable',
    fpAllocated: 10,
    fpAllocation: { attack: 4, defense: 2, mobility: 3, stability: 1 },
    createdAt: new Date().toISOString(),
    isActive: true,
  },
];

export const useGameStore = create<GameStore>((set, get) => ({
  roster: SEED_CYPHERS,
  primaryCypherId: 'seed-1',
  genesisWizard: INITIAL_WIZARD,
  battles: [],

  setPrimaryCypher: (id) => set({ primaryCypherId: id }),

  createCypher: (cypher) => set((state) => ({
    roster: [...state.roster, cypher],
  })),

  updateCypher: (id, updates) => set((state) => ({
    roster: state.roster.map(c => c.id === id ? { ...c, ...updates } : c),
  })),

  deleteCypher: (id) => set((state) => ({
    roster: state.roster.filter(c => c.id !== id),
    primaryCypherId: state.primaryCypherId === id ? null : state.primaryCypherId,
  })),

  updateWizardStep: (step, data) => set((state) => ({
    genesisWizard: { ...state.genesisWizard, step, ...data },
  })),

  resetWizard: () => set({ genesisWizard: { ...INITIAL_WIZARD, bonusAllocation: { ...EMPTY_BONUS } } }),

  autoStructure: () => {
    set((state) => ({
      genesisWizard: {
        ...state.genesisWizard,
        sizeClass: 'Standard',
        mobility: 'Balanced',
        combatStyle: 'Tactical',
      },
    }));
  },

  addBattle: (battle) => set((state) => ({
    battles: [battle, ...state.battles],
  })),

  loadUserCyphers: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('cyphers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to load cyphers:', error.message);
        return;
      }

      const cyphers: Cypher[] = (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        originLog: row.origin_log ?? undefined,
        description: row.description ?? '',
        imageUrl: row.image_url ?? undefined,
        modelUrl: row.model_url ?? null,
        modelGeneratedAt: row.model_generated_at ?? null,
        imageFrontUrl: row.image_front_url ?? null,
        imageRightUrl: row.image_right_url ?? null,
        imageLeftUrl: row.image_left_url ?? null,
        attackFrontUrl: row.attack_front_url ?? null,
        attackRightUrl: row.attack_right_url ?? null,
        attackLeftUrl: row.attack_left_url ?? null,
        defendFrontUrl: row.defend_front_url ?? null,
        defendRightUrl: row.defend_right_url ?? null,
        defendLeftUrl: row.defend_left_url ?? null,
        generationPrompt: row.generation_prompt ?? null,
        generationSeed: row.generation_seed ?? null,
        posesGeneratedAt: row.poses_generated_at ?? null,
        sizeClass: row.size_class,
        mobility: row.mobility,
        combatStyle: row.combat_style,
        kit: row.kit ?? { basicAttack: '', special1: '', special2: '', defense: '', passive: '', weakness: '' },
        stats: row.movement_speed != null ? {
          movement_speed: row.movement_speed,
          attack_range: row.attack_range,
          melee_power: row.melee_power,
          defense_rating: row.defense_rating,
          special_range: row.special_range,
          initiative: row.initiative,
        } : undefined,
        bonusAllocation: row.bonus_points_allocated ?? undefined,
        conditionState: row.condition_state ?? 'Stable',
        fpAllocated: row.fp_allocated ?? 0,
        fpAllocation: row.fp ?? { attack: 0, defense: 0, mobility: 0, stability: 0 },
        createdAt: row.created_at,
        isActive: row.is_active ?? false,
      }));

      set({ roster: cyphers });
    } catch (err) {
      console.warn('loadUserCyphers error:', err);
    }
  },

  setActive: (id, isActive) => set((state) => {
    const activeCount = state.roster.filter(c => c.isActive && c.id !== id).length;
    if (isActive && activeCount >= 3) {
      return state;
    }
    return {
      roster: state.roster.map(c => c.id === id ? { ...c, isActive } : c),
    };
  }),

  getActiveRoster: () => {
    return get().roster.filter(c => c.isActive);
  },
}));
