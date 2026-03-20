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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackHeader } from '../components/BackHeader';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { generatePoseGLB } from '../lib/falClient';
import { ModelViewer } from '../components/viewer/ModelViewer';
import { useEffect } from 'react';
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

type SheetView = 'sheet' | 'poses';

export default function CyphersScreen() {
  const { roster, deleteCypher, updateCypher } = useGameStore();
  const { user } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    roster.length > 0 ? roster[0].id : null
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetView, setSheetView] = useState<SheetView>('sheet');

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

  const handleSelectCypher = (id: string) => {
    setSelectedId(id);
    setSheetView('sheet');
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
                      onPress={() => handleSelectCypher(cypher.id)}
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
          <View style={styles.mainDisplay}>
            {selectedCypher ? (
              <>
                {/* View Toggle Header */}
                <View style={styles.viewToggleBar}>
                  <TouchableOpacity
                    style={[styles.viewToggleBtn, sheetView === 'sheet' && styles.viewToggleBtnActive]}
                    onPress={() => setSheetView('sheet')}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={13}
                      color={sheetView === 'sheet' ? '#ffffff' : '#6b7280'}
                    />
                    <Text style={[styles.viewToggleBtnText, sheetView === 'sheet' && styles.viewToggleBtnTextActive]}>
                      Sheet
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewToggleBtn, sheetView === 'poses' && styles.viewToggleBtnActive]}
                    onPress={() => setSheetView('poses')}
                  >
                    <Ionicons
                      name="body-outline"
                      size={13}
                      color={sheetView === 'poses' ? '#ffffff' : '#6b7280'}
                    />
                    <Text style={[styles.viewToggleBtnText, sheetView === 'poses' && styles.viewToggleBtnTextActive]}>
                      Poses
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.mainScroll}
                  contentContainerStyle={styles.mainContent}
                  showsVerticalScrollIndicator={false}
                >
                  {sheetView === 'sheet' ? (
                    <CypherSheet cypher={selectedCypher} />
                  ) : (
                    <PoseHub
                      cypher={selectedCypher}
                      onPoseUpdate={(updates) => {
                        updateCypher(selectedCypher.id, updates);
                        if (user) {
                          supabase.from('cyphers').update(updates).eq('id', selectedCypher.id).eq('user_id', user.id);
                        }
                      }}
                    />
                  )}
                </ScrollView>
              </>
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
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function fetchAndUpload(
  imageUrl: string,
  storagePath: string,
  contentType: 'image/jpeg' | 'image/png' = 'image/png'
): Promise<string | null> {
  try {
    console.log('UPLOAD PATH DEBUG: bucket =', 'cypher-images');
    console.log('UPLOAD PATH DEBUG: path =', storagePath);
    console.log('UPLOAD PATH DEBUG: full path length =', storagePath.length);
    console.log('UPLOAD: Fetching from:', imageUrl.slice(0, 80));

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log('UPLOAD: Buffer byteLength:', arrayBuffer.byteLength);
    if (arrayBuffer.byteLength === 0) throw new Error('Fetched buffer is empty');

    const { data, error } = await supabase.storage
      .from('cypher-images')
      .upload(storagePath, uint8Array, { contentType, upsert: true });

    console.log('UPLOAD PATH DEBUG: upload data =', JSON.stringify(data));
    console.log('UPLOAD PATH DEBUG: upload error =', JSON.stringify(error));

    if (error) throw new Error(`Upload error: ${error.message}`);

    const { data: publicData } = supabase.storage.from('cypher-images').getPublicUrl(storagePath);
    // Append cache-buster so CDN edge doesn't serve a stale 404 for newly uploaded files
    const cacheBustedUrl = `${publicData?.publicUrl}?v=${Date.now()}`;
    console.log('UPLOAD PATH DEBUG: public URL =', cacheBustedUrl);
    console.log('UPLOAD PATH DEBUG: public URL length =', cacheBustedUrl?.length);
    return cacheBustedUrl;
  } catch (err) {
    console.error('UPLOAD: Failed for path:', storagePath, err);
    return null;
  }
}

// ─── Pose Hub ─────────────────────────────────────────────────────────────────

interface PoseSet {
  id: string;
  cypher_id: string;
  pose_type: string;
  set_number: number;
  model_url: string | null;
  generation_method: string | null;
  // LEGACY PNG fields — kept for reference, no longer populated by new pipeline
  image_right_url: string | null;
  image_left_url: string | null;
  is_active: boolean;
}

interface PoseHubProps {
  cypher: Cypher;
  onPoseUpdate: (updates: Partial<Cypher>) => void;
}

const PoseHub: React.FC<PoseHubProps> = ({ cypher, onPoseUpdate }) => {
  const [poseGenerating, setPoseGenerating] = useState<'attack' | 'defend' | null>(null);
  const [poseGenerationStep, setPoseGenerationStep] = useState('');
  const [poseSets, setPoseSets] = useState<Record<string, PoseSet[]>>({});

  const canGenerate = !!(cypher.imageUrl && cypher.generationPrompt && cypher.generationSeed != null);

  // Load pose sets whenever the selected cypher changes
  useEffect(() => {
    loadPoseSets(cypher.id);
  }, [cypher.id]);

  const loadPoseSets = async (cypherId: string) => {
    console.log('POSE SETS DISPLAY: Loading sets for cypher:', cypherId);
    const { data, error } = await supabase
      .from('cypher_pose_sets')
      .select('*')
      .eq('cypher_id', cypherId)
      .order('pose_type', { ascending: true })
      .order('set_number', { ascending: true });

    console.log('POSE SETS DISPLAY: Loaded:', data?.length ?? 0, 'sets', error?.message ?? 'no error');

    if (data) {
      // Debug: log each set's URLs for diagnosis
      const attackSets = data.filter(s => s.pose_type === 'attack');
      const defendSets = data.filter(s => s.pose_type === 'defend');
      console.log('POSE SETS DISPLAY: Attack sets:', attackSets.length);
      console.log('POSE SETS DISPLAY: Defend sets:', defendSets.length);
      attackSets.forEach((set, i) => {
        console.log(`POSE SETS DISPLAY: Attack set ${i + 1}:`, {
          id: set.id,
          set_number: set.set_number,
          is_active: set.is_active,
          image_right_url: set.image_right_url,
          image_left_url: set.image_left_url,
        });
      });
      defendSets.forEach((set, i) => {
        console.log(`POSE SETS DISPLAY: Defend set ${i + 1}:`, {
          id: set.id,
          set_number: set.set_number,
          is_active: set.is_active,
          image_right_url: set.image_right_url,
          image_left_url: set.image_left_url,
        });
      });

      const grouped = data.reduce((acc, set) => {
        if (!acc[set.pose_type]) acc[set.pose_type] = [];
        acc[set.pose_type].push(set as PoseSet);
        return acc;
      }, {} as Record<string, PoseSet[]>);
      setPoseSets(grouped);
    }
  };

  const generatePoseSet = async (poseType: 'attack' | 'defend') => {
    const poseDescription = poseType === 'attack'
      ? cypher.kit.basicAttack
      : cypher.kit.defense;

    const baseImageUrl = cypher.imageUrl;
    const generationPrompt = cypher.generationPrompt;
    const generationSeed = cypher.generationSeed ?? Math.floor(Math.random() * 1000000);

    if (!baseImageUrl) {
      console.error('POSE GEN ERROR: No base image URL on cypher');
      Alert.alert('Error', 'No base image found for this cypher.');
      return;
    }
    if (!generationPrompt) {
      console.error('POSE GEN ERROR: No generation prompt on cypher');
      Alert.alert('Error', 'Generation prompt not found. Please recreate this cypher.');
      return;
    }

    setPoseGenerating(poseType);
    setPoseGenerationStep(`Preparing ${poseType} pose...`);

    try {
      // ── Get auth user ──────────────────────────────────────────────────────
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('No authenticated user');

      // ── Get next set number ────────────────────────────────────────────────
      const { data: existing } = await supabase
        .from('cypher_pose_sets')
        .select('set_number')
        .eq('cypher_id', cypher.id)
        .eq('pose_type', poseType)
        .order('set_number', { ascending: false })
        .limit(1);

      const nextSetNumber = existing && existing.length > 0 ? existing[0].set_number + 1 : 1;
      const isFirst = nextSetNumber === 1;

      // ── Generate pose GLB via Tripo ────────────────────────────────────────
      setPoseGenerationStep(`Generating ${poseType} pose...`);
      console.log(`POSE GEN: ${poseType} — base: ${baseImageUrl.slice(0, 60)}`);
      console.log(`POSE GEN: prompt: ${generationPrompt.slice(0, 80)}`);
      console.log(`POSE GEN: desc: ${poseDescription}, seed: ${generationSeed}, set: ${nextSetNumber}`);

      const poseModelUrl = await generatePoseGLB(
        baseImageUrl,
        generationPrompt,
        generationSeed,
        poseType,
        poseDescription,
        cypher.id,
        authUser.id,
        nextSetNumber
      );

      console.log(`POSE GEN: GLB URL: ${poseModelUrl?.slice(0, 60) ?? 'null'}`);
      if (!poseModelUrl) throw new Error('Pose GLB generation returned null');

      // ── Insert into cypher_pose_sets ───────────────────────────────────────
      setPoseGenerationStep('Saving pose set...');

      if (isFirst) {
        await supabase
          .from('cypher_pose_sets')
          .update({ is_active: false })
          .eq('cypher_id', cypher.id)
          .eq('pose_type', poseType);
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('cypher_pose_sets')
        .insert({
          cypher_id: cypher.id,
          user_id: authUser.id,
          pose_type: poseType,
          set_number: nextSetNumber,
          model_url: poseModelUrl,
          generation_method: 'tripo',
          is_active: isFirst,
          fp_cost: 0,
        })
        .select()
        .single();

      console.log('POSE GEN: insert result:', inserted?.id ?? 'null', insertErr?.message ?? 'ok');
      if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

      // ── Sync model_url to cyphers table for battle fallback (first/active set) ─
      if (isFirst) {
        const colUpdates = poseType === 'attack'
          ? { attack_model_url: poseModelUrl }
          : { defend_model_url: poseModelUrl };

        const { error: colErr } = await supabase
          .from('cyphers')
          .update(colUpdates)
          .eq('id', cypher.id);

        console.log('POSE GEN: cyphers column update:', colErr?.message ?? 'ok');
        onPoseUpdate(poseType === 'attack' ? { attackRightUrl: poseModelUrl } : { defendRightUrl: poseModelUrl });
      }

      // ============================================================
      // LEGACY PNG POSE GENERATION — COMMENTED OUT
      // Replaced by Tripo GLB pose pipeline above
      // ============================================================
      /*
      const rightUrl = await generatePoseImage(baseImageUrl, generationPrompt, generationSeed, poseType, poseDescription, 'right');
      if (!rightUrl) throw new Error('Right facing generation returned null');
      await new Promise(r => setTimeout(r, 1000));
      const leftUrl = await generatePoseImage(baseImageUrl, generationPrompt, generationSeed, poseType, poseDescription, 'left');
      if (!leftUrl) throw new Error('Left facing generation returned null');
      const ts = Date.now();
      const sanitizedCypherId = cypher.id.replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedUserId = authUser.id.replace(/[^a-zA-Z0-9-]/g, '');
      const rightPath = `${sanitizedUserId}/${sanitizedCypherId}/${poseType}_right_${ts}.png`;
      const leftPath  = `${sanitizedUserId}/${sanitizedCypherId}/${poseType}_left_${ts}.png`;
      const rightFinalUrl = await fetchAndUpload(rightUrl, rightPath, 'image/png');
      const leftFinalUrl  = await fetchAndUpload(leftUrl,  leftPath,  'image/png');
      */

      // ── Reload pose sets ───────────────────────────────────────────────────
      setPoseGenerationStep('Loading poses...');
      await new Promise(r => setTimeout(r, 500));
      await loadPoseSets(cypher.id);

      console.log(`POSE GEN: Complete — ${poseType} set ${nextSetNumber} saved`);

    } catch (err) {
      console.error('POSE GEN FAILED:', err);
      Alert.alert(
        'Pose Generation Failed',
        err instanceof Error ? err.message : 'Unknown error. Check console.'
      );
    } finally {
      setPoseGenerating(null);
      setPoseGenerationStep('');
    }
  };

  const setActivePoseSet = async (setId: string, poseType: string) => {
    console.log('POSE SET ACTIVATE:', setId, poseType);

    await supabase
      .from('cypher_pose_sets')
      .update({ is_active: false })
      .eq('cypher_id', cypher.id)
      .eq('pose_type', poseType);

    await supabase
      .from('cypher_pose_sets')
      .update({ is_active: true })
      .eq('id', setId);

    const activeSet = poseSets[poseType]?.find(s => s.id === setId);
    if (activeSet?.model_url) {
      const colUpdates = poseType === 'attack'
        ? { attack_model_url: activeSet.model_url }
        : { defend_model_url: activeSet.model_url };

      await supabase.from('cyphers').update(colUpdates).eq('id', cypher.id);

      const storeUpdate = poseType === 'attack'
        ? { attackRightUrl: activeSet.model_url }
        : { defendRightUrl: activeSet.model_url };
      onPoseUpdate(storeUpdate as any);
    }

    await loadPoseSets(cypher.id);
  };

  return (
    <View style={poseStyles.container}>
      <Text style={poseStyles.hubTitle}>{cypher.name}</Text>
      <Text style={poseStyles.hubSub}>Pose Library</Text>

      {/* ── 3D Character Model ── */}
      <View style={poseStyles.section}>
        <Text style={poseStyles.sectionTitle}>3D CHARACTER MODEL</Text>
        <Text style={poseStyles.sectionSub}>
          {cypher.modelUrl ? 'Drag to rotate · Pinch to zoom' : 'No 3D model — recreate cypher to generate'}
        </Text>
        {cypher.modelUrl ? (
          <ModelViewer modelUrl={cypher.modelUrl} height={340} autoRotate />
        ) : (
          <View style={poseStyles.glbPreview}>
            <Text style={poseStyles.glbIcon}>⬡</Text>
            <Text style={[poseStyles.glbReadyText, { color: '#4b5563' }]}>No model available</Text>
          </View>
        )}
      </View>

      {/* ── Default Battle Poses (Legacy PNG) ── */}
      <View style={poseStyles.section}>
        <Text style={poseStyles.sectionTitle}>DEFAULT BATTLE POSES</Text>
        <Text style={poseStyles.sectionSub}>Legacy PNG directional sprites (older cyphers only)</Text>
        <View style={poseStyles.poseRow}>
          <PoseCard label="Front" imageUrl={cypher.imageFrontUrl ?? cypher.imageUrl ?? null} />
          <PoseCard label="Right" imageUrl={cypher.imageRightUrl ?? null} />
          <PoseCard label="Left" imageUrl={cypher.imageLeftUrl ?? null} />
        </View>
      </View>

      {/* ── Attack Pose ── */}
      <PoseSectionWithSets
        poseType="attack"
        label="ATTACK POSE"
        subtitle={`Triggered when using ${cypher.kit.basicAttack} in battle`}
        sets={poseSets['attack'] ?? []}
        isGenerating={poseGenerating === 'attack'}
        generationStep={poseGenerationStep}
        canGenerate={canGenerate}
        onGenerate={() => generatePoseSet('attack')}
        onSetActive={(id) => setActivePoseSet(id, 'attack')}
        accentColor="#f97316"
        icon="flash"
      />

      {/* ── Defend Pose ── */}
      <PoseSectionWithSets
        poseType="defend"
        label="DEFEND POSE"
        subtitle={`Triggered when using ${cypher.kit.defense} in battle`}
        sets={poseSets['defend'] ?? []}
        isGenerating={poseGenerating === 'defend'}
        generationStep={poseGenerationStep}
        canGenerate={canGenerate}
        onGenerate={() => generatePoseSet('defend')}
        onSetActive={(id) => setActivePoseSet(id, 'defend')}
        accentColor="#3b82f6"
        icon="shield"
      />

      {!canGenerate && (
        <Text style={poseStyles.noGenerateHint}>
          Pose generation requires a cypher created with the Genesis Wizard.
        </Text>
      )}
    </View>
  );
};

// ─── Pose Section With Sets ────────────────────────────────────────────────────

interface PoseSectionProps {
  poseType: string;
  label: string;
  subtitle: string;
  sets: PoseSet[];
  isGenerating: boolean;
  generationStep: string;
  canGenerate: boolean;
  onGenerate: () => void;
  onSetActive: (id: string) => void;
  accentColor: string;
  icon: string;
}

const PoseSectionWithSets: React.FC<PoseSectionProps> = ({
  label, subtitle, sets, isGenerating, generationStep, canGenerate, onGenerate, onSetActive, accentColor, icon,
}) => (
  <View style={poseStyles.section}>
    <Text style={poseStyles.sectionTitle}>{label}</Text>
    <Text style={poseStyles.sectionSub}>{subtitle}</Text>

    {/* Existing sets */}
    {sets.map((set) => (
      <View
        key={set.id}
        style={[poseStyles.setCard, set.is_active && { borderColor: accentColor }]}
      >
        <View style={poseStyles.setCardHeader}>
          <Text style={poseStyles.setCardLabel}>Set {set.set_number}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {set.generation_method === 'tripo' && (
              <View style={poseStyles.tripobadge}>
                <Text style={poseStyles.tripoBadgeText}>3D</Text>
              </View>
            )}
            {set.is_active && (
              <View style={poseStyles.activeBadge}>
                <Text style={poseStyles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
        </View>
        {set.model_url ? (
          <View style={poseStyles.glbPreview}>
            <Text style={poseStyles.glbIcon}>⬡</Text>
            <Text style={poseStyles.glbReadyText}>3D Model Ready</Text>
            <Text style={poseStyles.glbFileName} numberOfLines={1}>
              {set.model_url.split('/').pop()?.split('?')[0]}
            </Text>
          </View>
        ) : (
          <View style={poseStyles.glbPreview}>
            <Text style={poseStyles.glbIcon}>⬡</Text>
            <Text style={[poseStyles.glbReadyText, { color: '#4b5563' }]}>No model</Text>
          </View>
        )}
        {!set.is_active && (
          <TouchableOpacity style={[poseStyles.setActiveBtn, { borderColor: accentColor }]} onPress={() => onSetActive(set.id)}>
            <Text style={[poseStyles.setActiveBtnText, { color: accentColor }]}>Set as Active</Text>
          </TouchableOpacity>
        )}
      </View>
    ))}

    {/* Generate button or loading */}
    {isGenerating ? (
      <View style={poseStyles.loadingBlock}>
        <ActivityIndicator color={accentColor} size="small" />
        <Text style={poseStyles.loadingText}>{generationStep}</Text>
      </View>
    ) : (
      <TouchableOpacity
        style={[
          poseStyles.generateBtn,
          { backgroundColor: accentColor },
          !canGenerate && poseStyles.generateBtnDisabled,
        ]}
        onPress={onGenerate}
        disabled={!canGenerate || isGenerating}
      >
        <Ionicons name={icon as any} size={16} color="#ffffff" />
        <Text style={poseStyles.generateBtnText}>
          {sets.length > 0 ? 'Generate New Set' : `Generate ${label.charAt(0) + label.slice(1).toLowerCase().replace(' pose', '')} Pose`}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

const PoseCard: React.FC<{ label: string; imageUrl: string | null }> = ({ label, imageUrl }) => (
  <View style={poseStyles.poseCard}>
    {imageUrl ? (
      <Image
        source={{ uri: imageUrl }}
        style={poseStyles.poseImage}
        resizeMode="contain"
        onLoad={() => console.log('POSE IMAGE: Loaded ok —', imageUrl.slice(0, 70))}
        onError={(e) => console.error('POSE IMAGE: Failed to load —', imageUrl.slice(0, 70), e.nativeEvent.error)}
      />
    ) : (
      <View style={poseStyles.posePlaceholder}>
        <Ionicons name="body-outline" size={24} color="#003566" />
        <Text style={poseStyles.posePlaceholderText}>None</Text>
      </View>
    )}
    <Text style={poseStyles.poseLabel}>{label}</Text>
  </View>
);

// ─── Cypher Sheet ─────────────────────────────────────────────────────────────

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

// ─── Pose Hub Styles ──────────────────────────────────────────────────────────

const poseStyles = StyleSheet.create({
  container: { gap: 20 },
  hubTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  hubSub: { fontSize: 12, color: '#3b82f6', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: -14 },

  section: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#003566',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionSub: { fontSize: 11, color: '#6b7280' },

  poseRow: { flexDirection: 'row', gap: 8 },
  poseCard: {
    flex: 1,
    backgroundColor: '#000814',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#003566',
    overflow: 'hidden',
    alignItems: 'center',
  },
  poseImage: { width: '100%', height: 120 },
  posePlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  posePlaceholderText: { fontSize: 9, color: '#374151' },
  poseLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 5,
    textAlign: 'center',
  },

  setCard: {
    backgroundColor: '#000d1f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#003566',
    padding: 10,
    gap: 8,
  },
  setCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setCardLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  activeBadge: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 9, color: '#3b82f6', fontWeight: '700', letterSpacing: 0.8 },
  setActiveBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingVertical: 8,
    alignItems: 'center',
  },
  setActiveBtnText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 12, color: '#9ca3af' },

  noGenerateHint: { fontSize: 10, color: '#4b5563', textAlign: 'center' },

  glbPreview: {
    backgroundColor: '#000d1f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003566',
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  glbIcon: { fontSize: 28, color: '#3b82f6' },
  glbReadyText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  glbFileName: { fontSize: 9, color: '#4b5563', maxWidth: '100%' },

  tripobadge: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a855f7',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tripoBadgeText: { fontSize: 9, color: '#a855f7', fontWeight: '700', letterSpacing: 0.8 },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────

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
  viewToggleBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#003566',
    backgroundColor: '#000814',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003566',
  },
  viewToggleBtnActive: { backgroundColor: '#003566', borderColor: '#3b82f6' },
  viewToggleBtnText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  viewToggleBtnTextActive: { color: '#ffffff' },
  mainScroll: { flex: 1 },
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
