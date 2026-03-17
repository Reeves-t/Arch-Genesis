import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { deriveBaseStats, applyBonusPoints, STAT_CAPS } from '../../lib/statDerivation';
import { BonusAllocation } from '../../types';

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

export const ReviewStep: React.FC = () => {
  const { genesisWizard } = useGameStore();
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

  const bonus = genesisWizard.bonusAllocation || EMPTY_BONUS;
  const finalStats = applyBonusPoints(baseStats, bonus);

  const renderField = (label: string, value: string | undefined) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Not set'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Step 6: Review</Text>
      <Text style={styles.stepDescription}>
        Review your Cypher configuration before completing Genesis.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Identity</Text>
        {renderField('Name', genesisWizard.name)}
        {genesisWizard.originLog && renderField('Origin Log', genesisWizard.originLog)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Structure</Text>
        {renderField('Size Class', genesisWizard.sizeClass)}
        {renderField('Mobility', genesisWizard.mobility)}
        {renderField('Combat Style', genesisWizard.combatStyle)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kit</Text>
        {renderField('Basic Attack', kit.basicAttack)}
        {renderField('Special 1', kit.special1)}
        {renderField('Special 2', kit.special2)}
        {renderField('Defense', kit.defense)}
        {renderField('Passive', kit.passive)}
      </View>

      <View style={styles.weaknessSection}>
        <Text style={styles.weaknessLabel}>Weakness</Text>
        <Text style={styles.weaknessValue}>{kit.weakness || 'Not set'}</Text>
      </View>

      {genesisWizard.description ? (
        <View style={styles.battleProfileSection}>
          <Text style={styles.battleProfileTitle}>Battle Profile</Text>
          <Text style={styles.battleProfileText}>{genesisWizard.description}</Text>
        </View>
      ) : null}

      {/* Stats Summary */}
      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>Stats</Text>
        {STAT_KEYS.map((stat) => {
          const value = finalStats[stat];
          const cap = STAT_CAPS[stat];
          const color = STAT_COLORS[stat];
          const bonusVal = bonus[stat];
          return (
            <View key={stat} style={styles.statRow}>
              <Text style={styles.statLabel}>{STAT_LABELS[stat]}</Text>
              <View style={styles.statBarWrap}>
                <View style={styles.statBarTrack}>
                  <View
                    style={[
                      styles.statBarFill,
                      { width: `${(value / cap) * 100}%`, backgroundColor: color },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.statValue, { color }]}>
                {value}{bonusVal > 0 ? ` (+${bonusVal})` : ''}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Once created, your Cypher will begin in a Stable condition with 0 FP allocated.
          You can customize further from the Roster screen.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  stepDescription: { fontSize: 14, color: '#9ca3af', lineHeight: 20, marginBottom: 24 },

  section: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#003566',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#3b82f6', marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  fieldValue: { fontSize: 14, color: '#ffffff', fontWeight: '500' },

  weaknessSection: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  weaknessLabel: { fontSize: 12, color: '#ef4444', fontWeight: '600', marginBottom: 4 },
  weaknessValue: { fontSize: 14, color: '#fca5a5', fontWeight: '500' },

  battleProfileSection: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  battleProfileTitle: { fontSize: 16, fontWeight: '600', color: '#6366f1', marginBottom: 8 },
  battleProfileText: { fontSize: 14, color: '#d1d5db', lineHeight: 20, fontStyle: 'italic' },

  statsSection: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#003566',
  },
  statsSectionTitle: { fontSize: 16, fontWeight: '600', color: '#3b82f6', marginBottom: 12 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  statLabel: { fontSize: 12, color: '#9ca3af', width: 110 },
  statBarWrap: { flex: 1 },
  statBarTrack: {
    height: 5,
    backgroundColor: '#003566',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: { height: '100%', borderRadius: 3 },
  statValue: { fontSize: 13, fontWeight: '700', width: 52, textAlign: 'right' },

  infoBox: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 8,
  },
  infoText: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },
});
