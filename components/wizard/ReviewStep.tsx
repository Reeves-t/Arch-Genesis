import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';

export const ReviewStep: React.FC = () => {
  const { genesisWizard } = useGameStore();
  const kit = genesisWizard.kit || {};

  const renderField = (label: string, value: string | undefined) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Not set'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Step 5: Review</Text>
      <Text style={styles.stepDescription}>
        Review your Cypher configuration before completing Genesis.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Identity</Text>
        {renderField('Name', genesisWizard.name)}
        {renderField('Visual Style', genesisWizard.visualStyle)}
        {genesisWizard.originLog && renderField('Origin Log', genesisWizard.originLog)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Structure</Text>
        {renderField('Size Class', genesisWizard.sizeClass)}
        {renderField('Mobility', genesisWizard.mobility)}
        {renderField('Material', genesisWizard.material)}
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

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Once created, your Cypher will begin in a Stable condition with 0 FP allocated.
          You can allocate FP and customize further from the Roster screen.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#003566',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  weaknessSection: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  weaknessLabel: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    marginBottom: 4,
  },
  weaknessValue: {
    fontSize: 14,
    color: '#fca5a5',
    fontWeight: '500',
  },
  battleProfileSection: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  battleProfileTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 8,
  },
  battleProfileText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
});
