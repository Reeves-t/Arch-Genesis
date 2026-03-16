import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { WEAKNESSES } from '../../types';

const CUSTOM_KEY = '__custom__';

export const KitStep: React.FC = () => {
  const { genesisWizard, updateWizardStep } = useGameStore();
  const kit = genesisWizard.kit || {};

  const currentWeakness = kit.weakness || '';
  const weaknessPresets = WEAKNESSES as readonly string[];
  const isCustomWeakness = currentWeakness !== '' && !weaknessPresets.includes(currentWeakness);
  const [showCustomWeakness, setShowCustomWeakness] = useState(isCustomWeakness);

  const handleKitChange = (field: string, value: string) => {
    updateWizardStep(genesisWizard.step, {
      kit: { ...kit, [field]: value },
    });
  };

  const handleDescriptionChange = (value: string) => {
    updateWizardStep(genesisWizard.step, { description: value });
  };

  const handleWeaknessSelect = (value: string) => {
    if (value === CUSTOM_KEY) {
      setShowCustomWeakness(true);
      handleKitChange('weakness', '');
    } else {
      setShowCustomWeakness(false);
      handleKitChange('weakness', value);
    }
  };

  const abilityFields = [
    { key: 'basicAttack', label: 'Basic Attack', placeholder: 'e.g. Pulse Strike — a focused energy blast' },
    { key: 'special1', label: 'Special Ability 1', placeholder: 'e.g. Overload — channels max energy into a devastating beam' },
    { key: 'special2', label: 'Special Ability 2', placeholder: 'e.g. Phase Shift — teleports behind the opponent' },
    { key: 'defense', label: 'Defense Ability', placeholder: 'e.g. Crystalline Barrier — generates a reflective shield' },
    { key: 'passive', label: 'Passive', placeholder: 'e.g. Adaptive Core — learns from enemy patterns over time' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Step 4: Kit</Text>
      <Text style={styles.stepDescription}>
        Describe your Cypher's abilities in your own words. Be creative — these define how your Cypher fights.
      </Text>

      {abilityFields.map(({ key, label, placeholder }) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>{label} *</Text>
          <TextInput
            style={styles.input}
            value={(kit as any)[key] || ''}
            onChangeText={(v) => handleKitChange(key, v)}
            placeholder={placeholder}
            placeholderTextColor="#6b7280"
          />
        </View>
      ))}

      {/* Weakness with presets + custom */}
      <View style={styles.field}>
        <Text style={styles.label}>Weakness *</Text>
        <View style={styles.optionsRow}>
          {weaknessPresets.map((w) => (
            <TouchableOpacity
              key={w}
              style={[
                styles.option,
                !showCustomWeakness && currentWeakness === w && styles.optionSelected,
              ]}
              onPress={() => handleWeaknessSelect(w)}
            >
              <Text
                style={[
                  styles.optionText,
                  !showCustomWeakness && currentWeakness === w && styles.optionTextSelected,
                ]}
              >
                {w}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.option, styles.optionCustom, showCustomWeakness && styles.optionSelected]}
            onPress={() => handleWeaknessSelect(CUSTOM_KEY)}
          >
            <Text style={[styles.optionText, showCustomWeakness && styles.optionTextSelected]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>
        {showCustomWeakness && (
          <TextInput
            style={styles.input}
            value={currentWeakness}
            onChangeText={(v) => handleKitChange('weakness', v)}
            placeholder="Describe custom weakness..."
            placeholderTextColor="#6b7280"
          />
        )}
      </View>

      {/* Cypher Description / Battle Profile */}
      <View style={styles.descriptionSection}>
        <Text style={styles.label}>Cypher Description *</Text>
        <Text style={styles.descriptionHint}>
          Describe your Cypher's personality, fighting style, and lore. This is used by the AI to simulate and narrate battles — the more detail, the better.
        </Text>
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={genesisWizard.description || ''}
          onChangeText={handleDescriptionChange}
          placeholder="A ruthless crystalline entity that fights with surgical precision. Opens with rapid Pulse Strikes to test defenses, then exploits weaknesses with devastating specials..."
          placeholderTextColor="#6b7280"
          multiline
          numberOfLines={6}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  stepDescription: { fontSize: 14, color: '#9ca3af', lineHeight: 20, marginBottom: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#ffffff', marginBottom: 8 },
  input: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#003566',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  option: {
    backgroundColor: '#001d3d',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#003566',
    alignItems: 'center',
    minWidth: '45%',
    flex: 1,
  },
  optionCustom: {
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  optionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  optionTextSelected: {
    color: '#ffffff',
  },
  descriptionSection: {
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#003566',
  },
  descriptionHint: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
    marginBottom: 12,
  },
  descriptionInput: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
});
