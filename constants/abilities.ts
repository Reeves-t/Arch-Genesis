import { AbilityTemplate } from '../types';

export const ABILITY_TEMPLATES: AbilityTemplate[] = [
  // Basic Attacks
  { id: 'basic-strike', name: 'Strike', category: 'basic', description: 'Standard physical attack' },
  { id: 'basic-pulse', name: 'Pulse', category: 'basic', description: 'Energy-based attack' },
  { id: 'basic-burst', name: 'Burst', category: 'basic', description: 'Quick multi-hit attack' },

  // Special Abilities
  { id: 'special-overload', name: 'Overload', category: 'special', description: 'High-damage energy attack', fpCost: 2 },
  { id: 'special-fracture', name: 'Fracture', category: 'special', description: 'Armor-piercing attack', fpCost: 2 },
  { id: 'special-cascade', name: 'Cascade', category: 'special', description: 'Chain attack hitting multiple times', fpCost: 3 },
  { id: 'special-amplify', name: 'Amplify', category: 'special', description: 'Boost next attack', fpCost: 1 },
  { id: 'special-disrupt', name: 'Disrupt', category: 'special', description: 'Interrupt enemy action', fpCost: 2 },

  // Defense
  { id: 'defense-barrier', name: 'Barrier', category: 'defense', description: 'Energy shield' },
  { id: 'defense-evade', name: 'Evade', category: 'defense', description: 'Dodge incoming attack' },
  { id: 'defense-absorb', name: 'Absorb', category: 'defense', description: 'Convert damage to energy' },
  { id: 'defense-redirect', name: 'Redirect', category: 'defense', description: 'Reflect partial damage' },

  // Passives
  { id: 'passive-regen', name: 'Regeneration', category: 'passive', description: 'Gradual stability recovery' },
  { id: 'passive-resilience', name: 'Resilience', category: 'passive', description: 'Reduced condition degradation' },
  { id: 'passive-adaptive', name: 'Adaptive', category: 'passive', description: 'Resistance to repeated attacks' },
  { id: 'passive-momentum', name: 'Momentum', category: 'passive', description: 'Damage increases with consecutive hits' },

  // Weaknesses
  { id: 'weak-energy', name: 'Energy Vulnerable', category: 'weakness', description: 'Weak to energy attacks' },
  { id: 'weak-physical', name: 'Physical Vulnerable', category: 'weakness', description: 'Weak to physical attacks' },
  { id: 'weak-slow', name: 'Low Mobility', category: 'weakness', description: 'Reduced evasion' },
  { id: 'weak-fragile', name: 'Fragile Structure', category: 'weakness', description: 'Faster condition degradation' },
];

export const getAbilitiesByCategory = (category: AbilityTemplate['category']) => {
  return ABILITY_TEMPLATES.filter(a => a.category === category);
};
