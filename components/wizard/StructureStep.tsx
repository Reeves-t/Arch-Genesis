import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { SIZE_CLASSES, MOBILITIES, COMBAT_STYLES } from '../../types';

const CUSTOM_KEY = '__custom__';

export const StructureStep: React.FC = () => {
  const { genesisWizard, updateWizardStep } = useGameStore();

  const fields = [
    { label: 'Size Class', key: 'sizeClass', presets: SIZE_CLASSES },
    { label: 'Mobility', key: 'mobility', presets: MOBILITIES },
    { label: 'Combat Style', key: 'combatStyle', presets: COMBAT_STYLES },
  ] as const;

  const [customFields, setCustomFields] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const f of fields) {
      const val = (genesisWizard as any)[f.key];
      if (val && !(f.presets as readonly string[]).includes(val)) {
        init[f.key] = true;
      }
    }
    return init;
  });

  const handleSelect = (field: string, value: string) => {
    if (value === CUSTOM_KEY) {
      setCustomFields((prev) => ({ ...prev, [field]: true }));
      updateWizardStep(genesisWizard.step, { [field]: '' });
    } else {
      setCustomFields((prev) => ({ ...prev, [field]: false }));
      updateWizardStep(genesisWizard.step, { [field]: value });
    }
  };

  const handleCustomInput = (field: string, value: string) => {
    updateWizardStep(genesisWizard.step, { [field]: value });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 3: Structure</Text>
      <Text style={styles.stepDescription}>
        Define the physical and combat characteristics of your Cypher.
      </Text>

      {fields.map(({ label, key, presets }) => {
        const currentValue = (genesisWizard as any)[key] as string | undefined;
        const isCustom = customFields[key] || false;

        return (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label} *</Text>
            <View style={styles.optionsRow}>
              {(presets as readonly string[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.option,
                    !isCustom && currentValue === option && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(key, option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      !isCustom && currentValue === option && styles.optionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.option, styles.optionCustom, isCustom && styles.optionSelected]}
                onPress={() => handleSelect(key, CUSTOM_KEY)}
              >
                <Text style={[styles.optionText, isCustom && styles.optionTextSelected]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
            {isCustom && (
              <TextInput
                style={styles.input}
                value={currentValue || ''}
                onChangeText={(v) => handleCustomInput(key, v)}
                placeholder={`Describe custom ${label.toLowerCase()}...`}
                placeholderTextColor="#6b7280"
              />
            )}
          </View>
        );
      })}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Custom inputs are mapped to the nearest standard equivalent for stat calculation. Use the "Auto-Structure" button below to fill with balanced defaults.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 20 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  stepDescription: { fontSize: 14, color: '#9ca3af', lineHeight: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
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
  },
  option: {
    backgroundColor: '#001d3d',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#003566',
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
  },
  optionCustom: {
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  optionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  optionTextSelected: { color: '#ffffff' },
  infoBox: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginTop: 8,
  },
  infoText: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },
});
