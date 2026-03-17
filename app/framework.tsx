import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackHeader } from '../components/BackHeader';
import { useGameStore } from '../store/useGameStore';
import { Cypher } from '../types';

const CONDITION_COLORS: Record<string, string> = {
  Stable: '#22c55e',
  Pressured: '#eab308',
  Critical: '#f97316',
  Desperate: '#ef4444',
};

const COMBAT_COLORS: Record<string, string> = {
  Aggressive: '#ef4444',
  Tactical: '#3b82f6',
  Defensive: '#22c55e',
};

export default function FrameworkScreen() {
  const roster = useGameStore((s) => s.roster);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedCypher, setSelectedCypher] = useState<Cypher | null>(null);

  const handleSearchBattle = () => {
    if (!selectedCypher) return;
    setPickerVisible(false);
    router.push(`/battle?cypherId=${selectedCypher.id}`);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        <BackHeader title="Framework" />
        <View style={styles.body}>

          {/* Deployment */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DEPLOYMENT</Text>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>Deployment Coming Soon</Text>
            </View>
          </View>

          {/* PvE Battle */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PVE BATTLE</Text>
            <TouchableOpacity
              style={styles.battleCard}
              onPress={() => {
                setSelectedCypher(null);
                setPickerVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.battleCardInner}>
                <Text style={styles.battleTitle}>Enter Battle</Text>
                <Text style={styles.battleMeta}>Select a cypher to deploy</Text>
              </View>
              <View style={styles.battleArrow}>
                <Text style={styles.battleArrowText}>▶</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* PvP Battle */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PVP BATTLE</Text>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>PvP Coming Soon</Text>
            </View>
          </View>

        </View>
      </SafeAreaView>

      {/* Cypher Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECT CYPHER</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {roster.length === 0 ? (
                <Text style={styles.pickerEmpty}>No cyphers in your roster yet.</Text>
              ) : (
                roster.map((cypher) => {
                  const accentColor = COMBAT_COLORS[cypher.combatStyle] ?? '#3b82f6';
                  const condColor = CONDITION_COLORS[cypher.conditionState] ?? '#22c55e';
                  const isSelected = selectedCypher?.id === cypher.id;
                  return (
                    <TouchableOpacity
                      key={cypher.id}
                      style={[styles.pickerCard, isSelected && { borderColor: accentColor, backgroundColor: accentColor + '10' }]}
                      onPress={() => setSelectedCypher(cypher)}
                      activeOpacity={0.8}
                    >
                      {/* Portrait thumbnail */}
                      <View style={[styles.pickerThumb, { backgroundColor: accentColor + '18', borderColor: accentColor + '55' }]}>
                        {cypher.imageUrl ? (
                          <Image source={{ uri: cypher.imageUrl }} style={styles.pickerThumbImage} resizeMode="contain" />
                        ) : (
                          <Text style={[styles.pickerThumbLetter, { color: accentColor }]}>
                            {cypher.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>

                      {/* Info */}
                      <View style={styles.pickerInfo}>
                        <Text style={[styles.pickerName, { color: isSelected ? accentColor : '#ffffff' }]}>
                          {cypher.name}
                        </Text>
                        <Text style={styles.pickerMeta}>
                          {cypher.sizeClass} · {cypher.combatStyle}
                        </Text>
                        <View style={[styles.conditionPill, { backgroundColor: condColor + '20', borderColor: condColor }]}>
                          <Text style={[styles.conditionPillText, { color: condColor }]}>
                            {cypher.conditionState}
                          </Text>
                        </View>
                      </View>

                      {/* Selected checkmark */}
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: accentColor }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.searchBtn, !selectedCypher && styles.searchBtnDisabled]}
              onPress={handleSearchBattle}
              disabled={!selectedCypher}
              activeOpacity={0.85}
            >
              <Text style={styles.searchBtnText}>
                {selectedCypher ? `Search for Battle with ${selectedCypher.name}` : 'Select a Cypher'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  content: { flex: 1 },
  body: { flex: 1, padding: 20, gap: 28 },

  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  placeholderCard: {
    backgroundColor: '#050e1a',
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: '#0f2340',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 14, color: '#374151' },

  battleCard: {
    backgroundColor: '#001428',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  battleCardInner: { flex: 1, gap: 4 },
  battleTitle: { fontSize: 18, fontWeight: '700', color: '#3b82f6' },
  battleMeta: { fontSize: 12, color: '#6b7280' },
  battleArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  battleArrowText: { fontSize: 12, color: '#ffffff' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#050e1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#0f2340',
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f2340',
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 2.5,
  },
  modalClose: { fontSize: 16, color: '#6b7280', padding: 4 },

  pickerList: { paddingHorizontal: 16, paddingTop: 12 },
  pickerEmpty: { fontSize: 14, color: '#4b5563', textAlign: 'center', paddingVertical: 32 },

  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080f1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f2340',
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  pickerThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pickerThumbImage: { width: 60, height: 60 },
  pickerThumbLetter: { fontSize: 24, fontWeight: '800' },
  pickerInfo: { flex: 1, gap: 4 },
  pickerName: { fontSize: 16, fontWeight: '700' },
  pickerMeta: { fontSize: 11, color: '#6b7280' },
  conditionPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    marginTop: 2,
  },
  conditionPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: { fontSize: 13, color: '#ffffff', fontWeight: '700' },

  searchBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchBtnDisabled: { backgroundColor: '#0f2340', opacity: 0.5 },
  searchBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
