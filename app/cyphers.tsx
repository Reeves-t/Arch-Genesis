import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackHeader } from '../components/BackHeader';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { Cypher, CypherStats } from '../types';
import { STAT_CAPS } from '../lib/statDerivation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.30;

const STAT_DISPLAY: { key: keyof CypherStats; label: string; color: string }[] = [
  { key: 'movement_speed', label: 'Movement Speed', color: '#06b6d4' },
  { key: 'attack_range',   label: 'Attack Range',   color: '#f97316' },
  { key: 'melee_power',    label: 'Melee Power',    color: '#ef4444' },
  { key: 'defense_rating', label: 'Defense Rating', color: '#3b82f6' },
  { key: 'special_range',  label: 'Special Range',  color: '#a855f7' },
  { key: 'initiative',     label: 'Initiative',     color: '#eab308' },
];

export default function CyphersScreen() {
  const { roster, deleteCypher } = useGameStore();
  const { user } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    roster.length > 0 ? roster[0].id : null
  );
  const [panelOpen, setPanelOpen] = useState(true);

  const handleDelete = (cypher: Cypher) => {
    Alert.alert(
      'Delete Cypher',
      `Remove ${cypher.name} from your roster?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (selectedId === cypher.id) {
              const next = roster.find((c) => c.id !== cypher.id);
              setSelectedId(next?.id ?? null);
            }
            deleteCypher(cypher.id);
            if (user) {
              await supabase.from('cyphers').delete().eq('id', cypher.id).eq('user_id', user.id);
            }
          },
        },
      ]
    );
  };

  const selectedCypher = roster.find((c) => c.id === selectedId) || null;

  const conditionColor = (condition: string) => {
    switch (condition) {
      case 'Stable': return '#10b981';
      case 'Strained': return '#f59e0b';
      case 'Fractured': return '#ef4444';
      case 'Destabilized': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        <BackHeader title="Roster" />

        <View style={styles.body}>
          {/* Left Panel */}
          {panelOpen && (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Cyphers</Text>
                <TouchableOpacity onPress={() => setPanelOpen(false)}>
                  <Ionicons name="chevron-back" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.panelList} showsVerticalScrollIndicator={false}>
                {roster.length === 0 ? (
                  <Text style={styles.emptyText}>No cyphers yet</Text>
                ) : (
                  roster.map((cypher) => (
                    <TouchableOpacity
                      key={cypher.id}
                      style={[
                        styles.panelItem,
                        selectedId === cypher.id && styles.panelItemSelected,
                      ]}
                      onPress={() => setSelectedId(cypher.id)}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: conditionColor(cypher.conditionState) },
                        ]}
                      />
                      <View style={styles.panelItemInfo}>
                        <Text
                          style={[
                            styles.panelItemName,
                            selectedId === cypher.id && styles.panelItemNameSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {cypher.name}
                        </Text>
                        <Text style={styles.panelItemSub} numberOfLines={1}>
                          {cypher.combatStyle}
                        </Text>
                      </View>
                      {cypher.isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>A</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => handleDelete(cypher)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={14} color="#4b5563" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}

          {/* Collapse toggle when panel is closed */}
          {!panelOpen && (
            <TouchableOpacity style={styles.openPanelBtn} onPress={() => setPanelOpen(true)}>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}

          {/* Main Display */}
          <ScrollView
            style={styles.mainDisplay}
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedCypher ? (
              <CypherSheet cypher={selectedCypher} />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#003566" />
                <Text style={styles.emptyStateText}>
                  {roster.length === 0
                    ? 'Create your first Cypher in the Genesis Wizard'
                    : 'Select a Cypher to view its sheet'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CypherSheet: React.FC<{ cypher: Cypher }> = ({ cypher }) => {
  return (
    <View style={styles.sheet}>
      {/* Header */}
      <View style={styles.sheetHeader}>
        <Text style={styles.cypherName}>{cypher.name}</Text>
        <Text style={styles.cypherMeta}>{cypher.sizeClass} · {cypher.combatStyle}</Text>
      </View>

      {/* Origin Log */}
      {cypher.originLog ? (
        <View style={styles.originSection}>
          <Text style={styles.originText}>"{cypher.originLog}"</Text>
        </View>
      ) : null}

      {/* Battle Profile */}
      {cypher.description ? (
        <View style={styles.battleProfileCard}>
          <Text style={styles.battleProfileTitle}>Battle Profile</Text>
          <Text style={styles.battleProfileText}>{cypher.description}</Text>
        </View>
      ) : null}

      {/* Cypher Image */}
      {cypher.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: cypher.imageUrl }}
            style={styles.cypherImage}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {/* Structure Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Structure</Text>
        <View style={styles.structureGrid}>
          <View style={styles.structureItem}>
            <Text style={styles.structureLabel}>Size</Text>
            <Text style={styles.structureValue}>{cypher.sizeClass}</Text>
          </View>
          <View style={styles.structureItem}>
            <Text style={styles.structureLabel}>Mobility</Text>
            <Text style={styles.structureValue}>{cypher.mobility}</Text>
          </View>
          <View style={styles.structureItem}>
            <Text style={styles.structureLabel}>Combat</Text>
            <Text style={styles.structureValue}>{cypher.combatStyle}</Text>
          </View>
        </View>
      </View>

      {/* Kit Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kit</Text>
        <AbilityRow label="Basic Attack" value={cypher.kit.basicAttack} icon="flash" />
        <AbilityRow label="Special 1" value={cypher.kit.special1} icon="star" />
        <AbilityRow label="Special 2" value={cypher.kit.special2} icon="star" />
        <AbilityRow label="Defense" value={cypher.kit.defense} icon="shield" />
        <AbilityRow label="Passive" value={cypher.kit.passive} icon="sync" />
      </View>

      {/* Weakness */}
      <View style={styles.weaknessCard}>
        <View style={styles.weaknessHeader}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.weaknessTitle}>Weakness</Text>
        </View>
        <Text style={styles.weaknessValue}>{cypher.kit.weakness}</Text>
      </View>

      {/* Stats */}
      {cypher.stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats</Text>
          {STAT_DISPLAY.map(({ key, label, color }) => {
            const value = cypher.stats![key];
            const cap = STAT_CAPS[key];
            return (
              <View key={key} style={styles.statRow}>
                <Text style={styles.statLabel}>{label}</Text>
                <View style={styles.statBarTrack}>
                  <View
                    style={[
                      styles.statBarFill,
                      { width: `${(value / cap) * 100}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={[styles.statValue, { color }]}>{value}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Status Footer */}
      <View style={styles.statusFooter}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Condition</Text>
          <Text style={[styles.statusValue, { color: cypher.conditionState === 'Stable' ? '#10b981' : '#f59e0b' }]}>
            {cypher.conditionState}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>FP Allocated</Text>
          <Text style={styles.statusValue}>{cypher.fpAllocated}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={[styles.statusValue, { color: cypher.isActive ? '#10b981' : '#6b7280' }]}>
            {cypher.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const AbilityRow: React.FC<{ label: string; value: string; icon: string }> = ({ label, value, icon }) => (
  <View style={styles.abilityRow}>
    <View style={styles.abilityIconWrap}>
      <Ionicons name={icon as any} size={14} color="#3b82f6" />
    </View>
    <View style={styles.abilityInfo}>
      <Text style={styles.abilityLabel}>{label}</Text>
      <Text style={styles.abilityValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  content: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },

  // Left Panel
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: '#001d3d',
    borderRightWidth: 1,
    borderRightColor: '#003566',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#003566',
  },
  panelTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  panelList: { flex: 1 },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#00254d',
    gap: 8,
  },
  panelItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  panelItemInfo: { flex: 1 },
  panelItemName: { fontSize: 13, fontWeight: '600', color: '#d1d5db' },
  panelItemNameSelected: { color: '#ffffff' },
  panelItemSub: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  activeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  emptyText: { fontSize: 12, color: '#6b7280', padding: 12, textAlign: 'center' },

  openPanelBtn: {
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#001d3d',
    borderRightWidth: 1,
    borderRightColor: '#003566',
  },

  // Main Display
  mainDisplay: { flex: 1 },
  mainContent: { padding: 16, paddingBottom: 40 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyStateText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },

  // Cypher Sheet
  sheet: { gap: 16 },
  sheetHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#003566',
  },
  cypherName: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  cypherMeta: { fontSize: 14, color: '#3b82f6', marginTop: 4, fontWeight: '500' },

  originSection: { paddingVertical: 8 },
  originText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', lineHeight: 20 },

  imageContainer: {
    alignItems: 'center',
    backgroundColor: '#000814',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f2340',
    overflow: 'hidden',
  },
  cypherImage: { width: '100%', height: 280 },

  card: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#003566',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Structure Grid
  structureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  structureItem: { width: '46%' },
  structureLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  structureValue: { fontSize: 14, color: '#ffffff', fontWeight: '500' },

  // Abilities
  abilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00254d',
    gap: 10,
  },
  abilityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  abilityInfo: { flex: 1 },
  abilityLabel: { fontSize: 10, color: '#6b7280' },
  abilityValue: { fontSize: 13, color: '#ffffff', fontWeight: '500' },

  // Weakness
  weaknessCard: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  weaknessHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  weaknessTitle: { fontSize: 14, fontWeight: '600', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1 },
  weaknessValue: { fontSize: 14, color: '#fca5a5', fontWeight: '500' },

  // Battle Profile
  battleProfileCard: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  battleProfileTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  battleProfileText: { fontSize: 13, color: '#d1d5db', lineHeight: 20, fontStyle: 'italic' },

  // Stats
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  statLabel: { fontSize: 11, color: '#9ca3af', width: 100 },
  statBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#003566',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: { height: '100%', borderRadius: 3 },
  statValue: { fontSize: 13, fontWeight: '700', width: 24, textAlign: 'right' },

  // Status Footer
  statusFooter: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#003566',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: { fontSize: 12, color: '#6b7280' },
  statusValue: { fontSize: 13, color: '#ffffff', fontWeight: '600' },
});
