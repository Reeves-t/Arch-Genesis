import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackHeader } from '../components/BackHeader';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import {
  removeBackground,
  generateTripoModel,
  // LEGACY PNG DIRECTIONAL — commented out, replaced by Tripo pipeline
  // generateDirectionalImages,
  // removeBackgroundSequential,
} from '../lib/falClient';
import { deriveBaseStats, applyBonusPoints, mapCustomStructureToStandard } from '../lib/statDerivation';
import { SketchStep } from '../components/wizard/SketchStep';
import { IdentityStep } from '../components/wizard/IdentityStep';
import { StructureStep } from '../components/wizard/StructureStep';
import { KitStep } from '../components/wizard/KitStep';
import { StatsStep } from '../components/wizard/StatsStep';
import { ReviewStep } from '../components/wizard/ReviewStep';
import { Cypher, BonusAllocation } from '../types';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function uploadImageToStorage(
  userId: string,
  imageUrl: string,
  path: string,
  contentType: 'image/jpeg' | 'image/png'
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cypher-images')
      .upload(path, uint8Array, { contentType, upsert: true });
    if (uploadError || !uploadData) {
      console.warn('[upload] storage error:', uploadError?.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from('cypher-images').getPublicUrl(uploadData.path);
    return urlData.publicUrl;
  } catch (err) {
    console.warn('[upload] exception:', err);
    return null;
  }
}

const STEP_NAMES = ['Sketch', 'Identity', 'Structure', 'Kit', 'Stats', 'Review'];

const EMPTY_BONUS: BonusAllocation = {
  movement_speed: 0, attack_range: 0, melee_power: 0,
  defense_rating: 0, special_range: 0, initiative: 0,
};

export default function CreateScreen() {
  const { genesisWizard, updateWizardStep, resetWizard, createCypher, autoStructure } = useGameStore();
  const { user } = useAuthStore();
  const currentStep = genesisWizard.step;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Generating your Cypher...');

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return genesisWizard.name.trim().length > 0;
      case 3:
        return !!genesisWizard.sizeClass?.trim() && !!genesisWizard.mobility?.trim() && !!genesisWizard.combatStyle?.trim();
      case 4: {
        const kit = genesisWizard.kit;
        return (
          !!kit?.basicAttack?.trim() &&
          !!kit?.special1?.trim() &&
          !!kit?.special2?.trim() &&
          !!kit?.defense?.trim() &&
          !!kit?.passive?.trim() &&
          !!kit?.weakness?.trim() &&
          !!genesisWizard.description?.trim()
        );
      }
      case 5: {
        const bonus = genesisWizard.bonusAllocation;
        if (!bonus) return false;
        const total = Object.values(bonus).reduce((sum, v) => sum + v, 0);
        return total === 6;
      }
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 6) {
      updateWizardStep(currentStep + 1, {});
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateWizardStep(currentStep - 1, {});
    }
  };

  const handleAutoStructure = () => {
    autoStructure();
    updateWizardStep(4, {});
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setLoadingText('Generating your Cypher...');

    const cypherId = generateUUID();
    let imageUrl: string | undefined = undefined;
    let modelUrl: string | null = null;
    // LEGACY PNG DIRECTIONAL — kept for reference
    // let imageFrontUrl: string | null = null;
    // let imageRightUrl: string | null = null;
    // let imageLeftUrl: string | null = null;

    // Retrieve prompt + seed stored in wizard state (set during variant selection)
    const generationPrompt: string | null = (genesisWizard as any).generationPrompt ?? null;
    const generationSeed: number | null = (genesisWizard as any).generationSeed ?? null;

    console.log('[handleComplete] user:', user?.id ?? 'NULL');
    console.log('[handleComplete] selectedImageUrl:', genesisWizard.selectedImageUrl ?? 'NULL');

    // ── Step 1: Background removal + upload of primary image ─────────────────
    if (user && genesisWizard.selectedImageUrl) {
      try {
        let uploadUrl = genesisWizard.selectedImageUrl;
        let contentType: 'image/jpeg' | 'image/png' = 'image/jpeg';
        let fileExt = 'jpg';

        try {
          console.log('[handleComplete] attempting background removal...');
          uploadUrl = await removeBackground(genesisWizard.selectedImageUrl);
          contentType = 'image/png';
          fileExt = 'png';
          console.log('[handleComplete] bg removal OK');
        } catch (bgErr) {
          console.warn('[handleComplete] bg removal failed, using original:', bgErr);
        }

        const primaryPath = `${user.id}/${Date.now()}.${fileExt}`;
        imageUrl = await uploadImageToStorage(user.id, uploadUrl, primaryPath, contentType) ?? undefined;
        console.log('[handleComplete] primary image uploaded:', imageUrl ?? 'FAILED');
      } catch (err) {
        console.warn('[handleComplete] image upload exception:', err);
      }
    } else {
      console.log('[handleComplete] skipping image upload — missing user or selectedImageUrl');
    }

    // ── Step 2: Generate 3D model via Tripo ──────────────────────────────────
    if (user && imageUrl) {
      setLoadingText('Generating 3D model...');
      try {
        console.log('[handleComplete] starting Tripo 3D generation...');
        modelUrl = await generateTripoModel(imageUrl, cypherId, user.id);
        console.log('[handleComplete] Tripo model URL:', modelUrl ?? 'null');
      } catch (err) {
        console.warn('[handleComplete] Tripo generation failed (non-blocking):', err);
      }
    }

    // ============================================================
    // LEGACY DIRECTIONAL PNG GENERATION — COMMENTED OUT
    // Replaced by Tripo 3D pipeline
    // ============================================================
    /*
    if (user && imageUrl && generationPrompt && generationSeed != null) {
      setLoadingText('Creating battle stances...');
      try {
        const directionals = await generateDirectionalImages(imageUrl, generationPrompt, generationSeed);
        setLoadingText('Removing backgrounds...');
        const cleaned = await removeBackgroundSequential([directionals.frontUrl, directionals.rightUrl, directionals.leftUrl]);
        setLoadingText('Uploading stances...');
        const [cleanFront, cleanRight, cleanLeft] = cleaned;
        if (cleanFront) imageFrontUrl = await uploadImageToStorage(user.id, cleanFront, `${user.id}/${cypherId}/front.png`, 'image/png');
        if (cleanRight) imageRightUrl = await uploadImageToStorage(user.id, cleanRight, `${user.id}/${cypherId}/right.png`, 'image/png');
        if (cleanLeft)  imageLeftUrl  = await uploadImageToStorage(user.id, cleanLeft,  `${user.id}/${cypherId}/left.png`,  'image/png');
      } catch (err) {
        console.warn('[handleComplete] directional generation failed (non-blocking):', err);
      }
    }
    */

    setLoadingText('Finalizing...');

    // ── Step 3: Compute final stats ───────────────────────────────────────────
    const kit = genesisWizard.kit as Cypher['kit'];
    const abilities = [kit.basicAttack, kit.special1, kit.special2, kit.defense, kit.passive];
    const bonus: BonusAllocation = genesisWizard.bonusAllocation || EMPTY_BONUS;
    const baseStats = deriveBaseStats(
      genesisWizard.sizeClass!,
      genesisWizard.mobility!,
      genesisWizard.combatStyle!,
      abilities
    );
    const finalStats = applyBonusPoints(baseStats, bonus);
    const standardMapping = mapCustomStructureToStandard(
      genesisWizard.sizeClass!,
      genesisWizard.mobility!,
      genesisWizard.combatStyle!
    );

    const newCypher: Cypher = {
      id: cypherId,
      name: genesisWizard.name,
      originLog: genesisWizard.originLog,
      description: genesisWizard.description || '',
      imageUrl,
      modelUrl: modelUrl ?? undefined,
      generationPrompt: generationPrompt ?? undefined,
      generationSeed: generationSeed ?? undefined,
      sizeClass: genesisWizard.sizeClass!,
      mobility: genesisWizard.mobility!,
      combatStyle: genesisWizard.combatStyle!,
      kit,
      stats: finalStats,
      bonusAllocation: bonus,
      conditionState: 'Stable',
      fpAllocated: 0,
      fpAllocation: { attack: 0, defense: 0, mobility: 0, stability: 0 },
      createdAt: new Date().toISOString(),
      isActive: false,
    };

    // ── Step 4: Save to local store ───────────────────────────────────────────
    createCypher(newCypher);

    // ── Step 5: Save to Supabase if authenticated ─────────────────────────────
    if (user) {
      try {
        const { error: cypherError } = await supabase.from('cyphers').insert({
          id: newCypher.id,
          user_id: user.id,
          name: newCypher.name,
          origin_log: newCypher.originLog || null,
          description: newCypher.description,
          image_url: newCypher.imageUrl || null,
          model_url: modelUrl,
          model_generated_at: modelUrl ? new Date().toISOString() : null,
          generation_prompt: generationPrompt,
          generation_seed: generationSeed,
          // LEGACY PNG DIRECTIONAL — columns kept in DB but no longer populated
          // image_front_url: null,
          // image_right_url: null,
          // image_left_url: null,
          size_class: newCypher.sizeClass,
          mobility: newCypher.mobility,
          combat_style: newCypher.combatStyle,
          kit: newCypher.kit,
          fp: newCypher.fpAllocation,
          is_active: newCypher.isActive,
          movement_speed: finalStats.movement_speed,
          attack_range: finalStats.attack_range,
          melee_power: finalStats.melee_power,
          defense_rating: finalStats.defense_rating,
          special_range: finalStats.special_range,
          initiative: finalStats.initiative,
          bonus_points_allocated: bonus,
          structure_standard_mapping: standardMapping,
        });

        if (!cypherError) {
          await supabase.from('cypher_sheets').insert({
            cypher_id: newCypher.id,
            user_id: user.id,
            origin_log: newCypher.originLog || null,
            visual_description: genesisWizard.visualDescription || null,
            size_class: newCypher.sizeClass,
            mobility: newCypher.mobility,
            combat_style: newCypher.combatStyle,
            basic_attack: newCypher.kit.basicAttack,
            special_1: newCypher.kit.special1,
            special_2: newCypher.kit.special2,
            defense_ability: newCypher.kit.defense,
            passive: newCypher.kit.passive,
            weakness: newCypher.kit.weakness,
            battle_profile: newCypher.description,
          });
        } else {
          console.warn('Failed to save cypher to Supabase:', cypherError.message);
        }
      } catch (err) {
        console.warn('Failed to save cypher to Supabase:', err);
      }
    }

    resetWizard();
    setIsLoading(false);
    router.replace('/cyphers');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <SketchStep />;
      case 2: return <IdentityStep />;
      case 3: return <StructureStep />;
      case 4: return <KitStep />;
      case 5: return <StatsStep />;
      case 6: return <ReviewStep />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        <BackHeader title="Genesis Wizard" />

        {/* Stepper */}
        <View style={styles.stepper}>
          {STEP_NAMES.map((name, index) => (
            <View key={index} style={styles.stepIndicator}>
              <View
                style={[
                  styles.stepDot,
                  index + 1 === currentStep && styles.stepDotActive,
                  index + 1 < currentStep && styles.stepDotComplete,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    (index + 1 === currentStep || index + 1 < currentStep) && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepName,
                  index + 1 === currentStep && styles.stepNameActive,
                ]}
              >
                {name}
              </Text>
            </View>
          ))}
        </View>

        {/* Step Content */}
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          {renderStep()}
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          {currentStep === 3 && (
            <TouchableOpacity style={styles.autoButton} onPress={handleAutoStructure}>
              <Text style={styles.autoButtonText}>Auto-Structure</Text>
            </TouchableOpacity>
          )}

          <View style={styles.navigation}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            {currentStep < 6 ? (
              <TouchableOpacity
                style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
                onPress={handleNext}
                disabled={!canProceed()}
              >
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.completeBtn} onPress={handleComplete} disabled={isLoading}>
                <Text style={styles.completeBtnText}>Complete Genesis</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Loading Overlay */}
      <Modal visible={isLoading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>{loadingText}</Text>
            <Text style={styles.loadingSubtext}>This may take a moment...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  content: { flex: 1 },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  stepIndicator: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#001d3d',
    borderWidth: 2,
    borderColor: '#003566',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  stepDotComplete: { backgroundColor: '#003566', borderColor: '#3b82f6' },
  stepNumber: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  stepNumberActive: { color: '#ffffff' },
  stepName: { fontSize: 10, color: '#6b7280' },
  stepNameActive: { color: '#3b82f6', fontWeight: '600' },
  stepContent: { flex: 1, paddingHorizontal: 20 },
  actions: { padding: 20, gap: 12 },
  autoButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  autoButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  navigation: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  backBtnText: { fontSize: 16, fontWeight: '600', color: '#3b82f6' },
  nextBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#003566', opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  completeBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  completeBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },

  // Loading overlay
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 8, 20, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingCard: {
    backgroundColor: '#001d3d',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#003566',
    gap: 16,
    width: '100%',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
