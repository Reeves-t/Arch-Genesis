import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import {
  deriveBaseStats,
  applyBonusPoints,
  STAT_CAPS,
  TOTAL_BONUS_POINTS,
  MAX_BONUS_PER_STAT,
  BonusAllocation,
} from '../../lib/statDerivation';

const STAT_KEYS = [
  'movement_speed',
  'attack_range',
  'melee_power',
  'defense_rating',
  'special_range',
  'initiative',
] as const;

const STAT_LABELS: Record<string, string> = {
  movement_speed: 'Movement Speed',
  attack_range: 'Attack Range',
  melee_power: 'Melee Power',
  defense_rating: 'Defense Rating',
  special_range: 'Special Range',
  initiative: 'Initiative',
};

const STAT_COLORS: Record<string, string> = {
  movement_speed: '#06b6d4',
  attack_range: '#f97316',
  melee_power: '#ef4444',
  defense_rating: '#3b82f6',
  special_range: '#a855f7',
  initiative: '#eab308',
};

const EMPTY_BONUS: BonusAllocation = {
  movement_speed: 0,
  attack_range: 0,
  melee_power: 0,
  defense_rating: 0,
  special_range: 0,
  initiative: 0,
};

export const StatsStep: React.FC = () => {
  const { genesisWizard, updateWizardStep } = useGameStore();
  const kit = genesisWizard.kit || {};

  const abilities = [
    kit.basicAttack || '',
    kit.special1 || '',
    kit.special2 || '',
    kit.defense || '',
    kit.passive || '',
  ];

  const baseStats = deriveBaseStats(
    genesisWizard.sizeClass || 'Standard',
    genesisWizard.mobility || 'Balanced',
    genesisWizard.combatStyle || 'Tactical',
    abilities
  );

  const bonus: BonusAllocation = genesisWizard.bonusAllocation || EMPTY_BONUS;
  const finalStats = applyBonusPoints(baseStats, bonus);

  const totalAllocated = STAT_KEYS.reduce((sum, k) => sum + bonus[k], 0);
  const remaining = TOTAL_BONUS_POINTS - totalAllocated;

  const handleAdjust = (stat: keyof BonusAllocation, delta: number) => {
    const current = bonus[stat];
    const next = current + delta;
    if (next < 0 || next > MAX_BONUS_PER_STAT) return;
    if (delta > 0 && remaining <= 0) return;
    updateWizardStep(genesisWizard.step, { bonusAllocation: { ...bonus, [stat]: next } });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Step 4.5: Stats</Text>
      <Text style={styles.stepDescription}>
        These stats are derived from your Structure choices. Allocate your 6 bonus points to strengthen your Cypher.
      </Text>

      <View style={[styles.remainingBox, remaining === 0 && styles.remainingBoxDone]}>
        <Text style={[styles.remainingText, remaining === 0 && styles.remainingTextDone]}>
          Bonus Points Remaining: {remaining}
        </Text>
      </View>

      {STAT_KEYS.map((stat) => {
        const base = baseStats[stat];
        const bonusVal = bonus[stat];
        const total = finalStats[stat];
        const cap = STAT_CAPS[stat];
        const color = STAT_COLORS[stat];
        const canAdd = bonusVal < MAX_BONUS_PER_STAT && remaining > 0;
        const canRemove = bonusVal > 0;

        return (
          <View key={stat} style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>{STAT_LABELS[stat]}</Text>
              <View style={styles.statValues}>
                <Text style={styles.baseLabel}>Base {base}</Text>
                <Text style={[styles.totalValue, { color }]}>{total}</Text>
              </View>
            </View>

            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(total / cap) * 100}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={styles.capLabel}>/{cap}</Text>
            </View>

            <View style={styles.bonusRow}>
              <TouchableOpacity
                style={[styles.adjBtn, !canRemove && styles.adjBtnDisabled]}
                onPress={() => handleAdjust(stat, -1)}
                disabled={!canRemove}
              >
                <Text style={styles.adjBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.bonusVal}>+{bonusVal} bonus</Text>
              <TouchableOpacity
                style={[styles.adjBtn, !canAdd && styles.adjBtnDisabled]}
                onPress={() => handleAdjust(stat, 1)}
                disabled={!canAdd}
              >
                <Text style={styles.adjBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          Stats are determined by your Structure choices and bonus points only. Your cypher descriptions do not affect these values.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  stepDescription: { fontSize: 14, color: '#9ca3af', lineHeight: 20, marginBottom: 16 },

  remainingBox: {
    backgroundColor: '#001d3d',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    marginBottom: 16,
  },
  remainingBoxDone: {
    borderColor: '#10b981',
  },
  remainingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  remainingTextDone: {
    color: '#10b981',
  },

  statCard: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#003566',
    gap: 10,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  statValues: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baseLabel: { fontSize: 12, color: '#6b7280' },
  totalValue: { fontSize: 22, fontWeight: '800' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#003566',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  capLabel: { fontSize: 11, color: '#6b7280', width: 24, textAlign: 'right' },

  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  adjBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjBtnDisabled: { backgroundColor: '#003566', opacity: 0.4 },
  adjBtnText: { fontSize: 20, fontWeight: '700', color: '#ffffff', lineHeight: 22 },
  bonusVal: { fontSize: 13, color: '#9ca3af', minWidth: 70, textAlign: 'center' },

  noteBox: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginTop: 4,
    marginBottom: 24,
  },
  noteText: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },
});
