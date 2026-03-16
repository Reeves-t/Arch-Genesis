import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { VISUAL_STYLES } from '../../types';

const CUSTOM_KEY = '__custom__';

export const IdentityStep: React.FC = () => {
  const { genesisWizard, updateWizardStep } = useGameStore();
  const presets = VISUAL_STYLES as readonly string[];
  const isCustom = genesisWizard.visualStyle !== undefined && !presets.includes(genesisWizard.visualStyle);
  const [showCustom, setShowCustom] = useState(isCustom);

  const handleNameChange = (name: string) => {
    updateWizardStep(genesisWizard.step, { name });
  };

  const handleStyleSelect = (style: string) => {
    if (style === CUSTOM_KEY) {
      setShowCustom(true);
      updateWizardStep(genesisWizard.step, { visualStyle: '' });
    } else {
      setShowCustom(false);
      updateWizardStep(genesisWizard.step, { visualStyle: style });
    }
  };

  const handleCustomStyle = (value: string) => {
    updateWizardStep(genesisWizard.step, { visualStyle: value });
  };

  const handleOriginChange = (originLog: string) => {
    updateWizardStep(genesisWizard.step, { originLog });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 2: Identity</Text>
      <Text style={styles.stepDescription}>
        Define the core identity of your Cypher.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={genesisWizard.name}
          onChangeText={handleNameChange}
          placeholder="Enter Cypher name..."
          placeholderTextColor="#6b7280"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Visual Style *</Text>
        <View style={styles.optionsGrid}>
          {presets.map((style) => (
            <TouchableOpacity
              key={style}
              style={[
                styles.option,
                !showCustom && genesisWizard.visualStyle === style && styles.optionSelected,
              ]}
              onPress={() => handleStyleSelect(style)}
            >
              <Text
                style={[
                  styles.optionText,
                  !showCustom && genesisWizard.visualStyle === style && styles.optionTextSelected,
                ]}
              >
                {style}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.option, styles.optionCustom, showCustom && styles.optionSelected]}
            onPress={() => handleStyleSelect(CUSTOM_KEY)}
          >
            <Text style={[styles.optionText, showCustom && styles.optionTextSelected]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>
        {showCustom && (
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={genesisWizard.visualStyle || ''}
            onChangeText={handleCustomStyle}
            placeholder="Describe your custom visual style..."
            placeholderTextColor="#6b7280"
          />
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Origin Log (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={genesisWizard.originLog}
          onChangeText={handleOriginChange}
          placeholder="Describe the origin story of your Cypher..."
          placeholderTextColor="#6b7280"
          multiline
          numberOfLines={4}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stepDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#003566',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionsGrid: {
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
    minWidth: '30%',
    flex: 1,
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
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  optionTextSelected: {
    color: '#ffffff',
  },
});
