import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';

export const IdentityStep: React.FC = () => {
  const { genesisWizard, updateWizardStep } = useGameStore();

  const handleNameChange = (name: string) => {
    updateWizardStep(genesisWizard.step, { name });
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
  textArea: { minHeight: 100, textAlignVertical: 'top' },
});
