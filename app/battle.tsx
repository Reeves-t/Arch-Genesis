import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useGameStore } from '../store/useGameStore';
import { supabase } from '../lib/supabase';
import { Cypher } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = Math.floor(SCREEN_WIDTH * 0.36);

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerOption {
  id: string;
  action_description: string;
  is_weakness_finisher: boolean;
  is_lucky_way_out_step: boolean;
}

interface NarratedLine {
  line: string;
  character: 'player' | 'opponent' | 'both';
}

interface TurnRecord {
  turn_number: number;
  player_move: string;
  opponent_move: string;
  advantage_delta: number;
  turn_winner: 'player' | 'opponent' | 'draw';
  narration_summary: string;
  narration_lines: NarratedLine[];
  expanded: boolean;
}

type BattlePhase = 'matchmaking' | 'battle' | 'end';
type TurnPhase = 'player_select' | 'opponent_thinking' | 'resolving' | 'narrating';
type InitiativeWinner = 'player' | 'opponent';
type MomentumEntry = 'player' | 'opponent' | 'draw';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONDITION_COLORS: Record<string, string> = {
  Stable: '#22c55e',
  Pressured: '#eab308',
  Critical: '#f97316',
  Desperate: '#ef4444',
};

const STYLE_COLORS: Record<string, string> = {
  Crystalline: '#3b82f6',
  Organic: '#22c55e',
  Geometric: '#a855f7',
  Ethereal: '#06b6d4',
};

function getCypherColor(cypher: Cypher): string {
  return STYLE_COLORS[cypher.visualStyle] ?? '#3b82f6';
}

function buildBattlePhase(turn: number): string {
  if (turn <= 2) return 'early';
  if (turn <= 4) return 'mid';
  return 'late';
}

function detectAbilityKey(moveDesc: string, kit: Cypher['kit']): string | null {
  const abilities: { key: string; name: string }[] = [
    { key: 'basicAttack', name: kit.basicAttack },
    { key: 'special1', name: kit.special1 },
    { key: 'special2', name: kit.special2 },
    { key: 'defense', name: kit.defense },
    { key: 'passive', name: kit.passive },
  ];
  const lower = moveDesc.toLowerCase();
  for (const a of abilities) {
    if (lower.includes(a.name.toLowerCase())) return a.key;
  }
  return null;
}

function calcInitiative(cypher: Cypher): number {
  let score = 0;
  if (cypher.mobility === 'Agile') score += 3;
  else if (cypher.mobility === 'Balanced') score += 1;
  else if (cypher.mobility === 'Grounded') score -= 1;

  if (cypher.sizeClass === 'Compact') score += 2;
  else if (cypher.sizeClass === 'Heavy') score -= 2;

  if (cypher.combatStyle === 'Aggressive') score += 1;
  else if (cypher.combatStyle === 'Defensive') score -= 1;

  return score;
}

function buildFallbackNPC(): Cypher {
  return {
    id: `npc-fallback-${Date.now()}`,
    name: 'Cipher-0',
    visualStyle: 'Geometric',
    originLog: 'An unknown entity from the outer Framework layers.',
    description:
      'A methodical fighter that reads and adapts to its opponent. Fights with cold precision, opening conservatively then striking hard when patterns are established.',
    sizeClass: 'Standard',
    mobility: 'Balanced',
    material: 'Adaptive',
    combatStyle: 'Tactical',
    kit: {
      basicAttack: 'Strike',
      special1: 'Overcharge',
      special2: 'Phase Shift',
      defense: 'Shield Wall',
      passive: 'Adaptation',
      weakness: 'Physical Vulnerable',
    },
    conditionState: 'Stable',
    fpAllocated: 0,
    fpAllocation: { attack: 0, defense: 0, mobility: 0, stability: 0 },
    createdAt: new Date().toISOString(),
    isActive: false,
  };
}

function buildInitialOptions(cypher: Cypher): PlayerOption[] {
  const k = cypher.kit;
  return [
    { id: 'opt_1', action_description: `Open with ${k.basicAttack} — press the attack directly`, is_weakness_finisher: false, is_lucky_way_out_step: false },
    { id: 'opt_2', action_description: `Unleash ${k.special1} at full force`, is_weakness_finisher: false, is_lucky_way_out_step: false },
    { id: 'opt_3', action_description: `Deploy ${k.defense} and hold the line`, is_weakness_finisher: false, is_lucky_way_out_step: false },
    { id: 'opt_4', action_description: `Activate ${k.passive} and strike with ${k.special2}`, is_weakness_finisher: false, is_lucky_way_out_step: false },
  ];
}

// ─── CypherPortrait ───────────────────────────────────────────────────────────

function CypherPortrait({ cypher, size }: { cypher: Cypher; size: number }) {
  const color = getCypherColor(cypher);
  if (cypher.imageUrl) {
    return (
      <Image
        source={{ uri: cypher.imageUrl }}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: color + '18', borderWidth: 1.5, borderColor: color + '55', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.38, color, fontWeight: '800' }}>{cypher.name.charAt(0).toUpperCase()}</Text>
      <Text style={{ fontSize: 10, color: color + '99', marginTop: 4, letterSpacing: 1 }}>{cypher.visualStyle.toUpperCase()}</Text>
    </View>
  );
}

// ─── TurnHistoryRow ───────────────────────────────────────────────────────────

function TurnHistoryRow({ record, onToggle }: { record: TurnRecord; onToggle: () => void }) {
  const winnerLabel =
    record.turn_winner === 'player' ? 'You pressed the advantage'
    : record.turn_winner === 'opponent' ? 'Opponent took the exchange'
    : 'Draw';

  return (
    <View style={histStyles.container}>
      <TouchableOpacity style={histStyles.header} onPress={onToggle} activeOpacity={0.7}>
        <Text style={histStyles.label}>
          Turn {record.turn_number}
          <Text style={[histStyles.result, record.turn_winner === 'player' ? histStyles.win : record.turn_winner === 'opponent' ? histStyles.loss : histStyles.draw]}>
            {' '}— {winnerLabel}
          </Text>
        </Text>
        <Text style={histStyles.chevron}>{record.expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {record.expanded && (
        <View style={histStyles.body}>
          {record.narration_lines.map((l, i) => (
            <Text key={i} style={histStyles.line}>{l.line}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const histStyles = StyleSheet.create({
  container: { marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 11, color: '#4b5563', flex: 1 },
  result: { fontWeight: '600' },
  win: { color: '#3b82f6' },
  loss: { color: '#ef4444' },
  draw: { color: '#6b7280' },
  chevron: { fontSize: 9, color: '#374151', paddingLeft: 8 },
  body: { paddingTop: 4, paddingBottom: 4, gap: 4 },
  line: { fontSize: 12, color: '#374151', lineHeight: 18, fontStyle: 'italic' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BattleScreen() {
  const { cypherId } = useLocalSearchParams<{ cypherId: string }>();
  const roster = useGameStore((s) => s.roster);
  const playerCypher = roster.find((c) => c.id === cypherId) ?? roster[0];

  // ── Battle state ─────────────────────────────────────────────────────────
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('matchmaking');
  const [opponentCypher, setOpponentCypher] = useState<Cypher | null>(null);
  const [advantageScore, setAdvantageScore] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [playerCondition, setPlayerCondition] = useState('Stable');
  const [opponentCondition, setOpponentCondition] = useState('Stable');
  const [playerOptions, setPlayerOptions] = useState<PlayerOption[]>([]);
  const [turnHistory, setTurnHistory] = useState<TurnRecord[]>([]);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('player_select');
  const [winner, setWinner] = useState<string | null>(null);
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [initiativeWinner, setInitiativeWinner] = useState<InitiativeWinner>('player');
  const [showInitiativeBanner, setShowInitiativeBanner] = useState(false);

  // ── Context trackers ─────────────────────────────────────────────────────
  const [keyMoments, setKeyMoments] = useState<string[]>([]);
  const [patternTracker, setPatternTracker] = useState<Record<string, number>>({});
  const [momentumTracker, setMomentumTracker] = useState<MomentumEntry[]>([]);

  // ── Narration state ──────────────────────────────────────────────────────
  const [narrationLines, setNarrationLines] = useState<NarratedLine[]>([]);
  const [completedLines, setCompletedLines] = useState<NarratedLine[]>([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [typewriterText, setTypewriterText] = useState('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const narrationScrollRef = useRef<ScrollView>(null);

  // ── Matchmaking state ────────────────────────────────────────────────────
  const MATCHMAKING_TEXTS = ['Scanning the Framework...', 'Locating opponent...', 'Preparing battlefield...'];
  const [matchmakingText, setMatchmakingText] = useState(MATCHMAKING_TEXTS[0]);

  // ── Animations ───────────────────────────────────────────────────────────
  const playerBreathe = useRef(new Animated.Value(1)).current;
  const opponentBreathe = useRef(new Animated.Value(1)).current;
  const playerPush = useRef(new Animated.Value(0)).current;
  const opponentPush = useRef(new Animated.Value(0)).current;
  const advantageAnim = useRef(new Animated.Value(0.5)).current;
  const loadingPulse = useRef(new Animated.Value(0.4)).current;

  // Breathing loops
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(playerBreathe, { toValue: 1.022, duration: 2200, useNativeDriver: true }),
      Animated.timing(playerBreathe, { toValue: 1, duration: 2200, useNativeDriver: true }),
    ])).start();
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(opponentBreathe, { toValue: 1.022, duration: 2500, useNativeDriver: true }),
        Animated.timing(opponentBreathe, { toValue: 1, duration: 2500, useNativeDriver: true }),
      ])).start();
    }, 1200);
  }, []);

  // Loading pulse
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(loadingPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(loadingPulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  // Matchmaking text cycling
  useEffect(() => {
    if (battlePhase !== 'matchmaking') return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % MATCHMAKING_TEXTS.length;
      setMatchmakingText(MATCHMAKING_TEXTS[idx]);
    }, 1000);
    return () => clearInterval(interval);
  }, [battlePhase]);

  // Kick off matchmaking
  useEffect(() => {
    if (battlePhase !== 'matchmaking' || !playerCypher) return;
    const run = async () => {
      try {
        const [npc] = await Promise.all([
          generateNPC(),
          new Promise<void>((res) => setTimeout(res, 3000)),
        ]);
        // Calculate initiative
        const playerInit = calcInitiative(playerCypher);
        const npcInit = calcInitiative(npc);
        let initWinner: InitiativeWinner;
        if (playerInit > npcInit) initWinner = 'player';
        else if (npcInit > playerInit) initWinner = 'opponent';
        else initWinner = Math.random() < 0.5 ? 'player' : 'opponent';

        setOpponentCypher(npc);
        setPlayerOptions(buildInitialOptions(playerCypher));
        setInitiativeWinner(initWinner);
        setShowInitiativeBanner(true);
        setBattlePhase('battle');
        setTurnPhase('player_select');
      } catch (err) {
        console.warn('NPC generation failed, using fallback:', err);
        const npc = buildFallbackNPC();
        const playerInit = calcInitiative(playerCypher);
        const npcInit = calcInitiative(npc);
        let initWinner: InitiativeWinner;
        if (playerInit > npcInit) initWinner = 'player';
        else if (npcInit > playerInit) initWinner = 'opponent';
        else initWinner = Math.random() < 0.5 ? 'player' : 'opponent';
        setOpponentCypher(npc);
        setPlayerOptions(buildInitialOptions(playerCypher));
        setInitiativeWinner(initWinner);
        setShowInitiativeBanner(true);
        setBattlePhase('battle');
        setTurnPhase('player_select');
      }
    };
    run();
  }, []);

  // Advantage bar animation
  useEffect(() => {
    const normalized = (advantageScore + 10) / 20;
    Animated.timing(advantageAnim, { toValue: normalized, duration: 700, useNativeDriver: false }).start();
  }, [advantageScore]);

  // Typewriter effect
  useEffect(() => {
    if (battlePhase !== 'battle' || turnPhase !== 'narrating') return;
    if (currentLineIdx >= narrationLines.length) {
      const timeoutId = setTimeout(() => {
        if (winner) setBattlePhase('end');
        else setTurnPhase('player_select');
      }, 500);
      return () => clearTimeout(timeoutId);
    }

    const line = narrationLines[currentLineIdx];
    let charIdx = 0;
    setTypewriterText('');

    if (line.character === 'player') {
      Animated.sequence([
        Animated.timing(playerPush, { toValue: 10, duration: 120, useNativeDriver: true }),
        Animated.timing(playerPush, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    } else if (line.character === 'opponent') {
      Animated.sequence([
        Animated.timing(opponentPush, { toValue: -10, duration: 120, useNativeDriver: true }),
        Animated.timing(opponentPush, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(playerPush, { toValue: 6, duration: 120, useNativeDriver: true }),
          Animated.timing(playerPush, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opponentPush, { toValue: -6, duration: 120, useNativeDriver: true }),
          Animated.timing(opponentPush, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    }

    typewriterRef.current = setInterval(() => {
      charIdx++;
      setTypewriterText(line.line.slice(0, charIdx));
      if (charIdx >= line.line.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        const holdTimeout = setTimeout(() => {
          setCompletedLines((prev) => [...prev, line]);
          setTypewriterText('');
          setCurrentLineIdx((prev) => prev + 1);
          // Scroll narration to bottom
          narrationScrollRef.current?.scrollToEnd({ animated: true });
        }, 650);
        return () => clearTimeout(holdTimeout);
      }
    }, 26);

    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, [currentLineIdx, turnPhase, battlePhase]);

  // ── API calls ───────────────────────────────────────────────────────────

  async function generateNPC(): Promise<Cypher> {
    const { data, error } = await supabase.functions.invoke('battle-framework-master', {
      body: { mode: 'generate_npc' },
    });
    if (error || !data) throw error ?? new Error('No NPC data');
    return {
      id: `npc-${Date.now()}`,
      name: data.name ?? 'Unknown',
      visualStyle: data.visualStyle ?? 'Geometric',
      originLog: data.originLog,
      description: data.description ?? 'An unknown entity.',
      sizeClass: data.sizeClass ?? 'Standard',
      mobility: data.mobility ?? 'Balanced',
      material: data.material ?? 'Adaptive',
      combatStyle: data.combatStyle ?? 'Tactical',
      kit: {
        basicAttack: data.basicAttack ?? 'Strike',
        special1: data.special1 ?? 'Surge',
        special2: data.special2 ?? 'Phase',
        defense: data.defense ?? 'Guard',
        passive: data.passive ?? 'Adapt',
        weakness: data.weakness ?? 'Physical Vulnerable',
      },
      conditionState: 'Stable',
      fpAllocated: 0,
      fpAllocation: { attack: 0, defense: 0, mobility: 0, stability: 0 },
      createdAt: new Date().toISOString(),
      isActive: false,
    };
  }

  const handleSelectMove = useCallback(
    async (option: PlayerOption) => {
      if (turnPhase !== 'player_select' || !opponentCypher || !playerCypher) return;

      // Hide initiative banner once first move is made
      setShowInitiativeBanner(false);
      setSelectedMoveId(option.id);
      setTurnPhase('opponent_thinking');

      await new Promise((res) => setTimeout(res, 1800));
      setTurnPhase('resolving');

      try {
        const bPhase = buildBattlePhase(currentTurn);

        // Build full match history for context injection (all turns)
        const fullMoveHistory = turnHistory.map((t) => ({
          turn_number: t.turn_number,
          player_move: t.player_move,
          opponent_move: t.opponent_move,
          advantage_delta: t.advantage_delta,
          turn_winner: t.turn_winner,
          narration_summary: t.narration_summary,
        }));

        const { data: turnData, error: turnError } = await supabase.functions.invoke(
          'battle-framework-master',
          {
            body: {
              mode: 'resolve_turn',
              player_cypher: playerCypher,
              opponent_cypher: opponentCypher,
              advantage_score: advantageScore,
              current_turn: currentTurn,
              move_history: fullMoveHistory,
              player_selected_move: option.action_description,
              battle_phase: bPhase,
              initiative_winner: initiativeWinner,
              key_moments: keyMoments,
              pattern_tracker: patternTracker,
              momentum_tracker: momentumTracker,
            },
          }
        );

        if (turnError || !turnData) throw turnError ?? new Error('No turn data');

        const { data: narrData } = await supabase.functions.invoke('battle-narrator', {
          body: {
            turn_result: { ...turnData, player_selected_move: option.action_description },
            player_cypher: playerCypher,
            opponent_cypher: opponentCypher,
            move_history: fullMoveHistory,
            current_turn: currentTurn,
            battle_phase: bPhase,
            initiative_winner: initiativeWinner,
            turn_winner: turnData.turn_winner ?? 'draw',
            last_turn_context: turnData.last_turn_context ?? null,
            opponent_move_reasoning: turnData.opponent_move_reasoning ?? null,
            key_moments_this_turn: turnData.key_moments_this_turn ?? [],
            player_pattern_detected: turnData.player_pattern_detected ?? false,
            pattern_description: turnData.pattern_description ?? null,
            match_narrative_state: turnData.match_narrative_state ?? 'opening',
          },
        });

        const newAdvantage = turnData.new_advantage_score ?? advantageScore;
        const turnWinner: MomentumEntry = turnData.turn_winner ?? 'draw';
        const isBattleOver = turnData.is_battle_over ?? false;
        const battleWinner = turnData.winner ?? (newAdvantage >= 0 ? 'player' : 'opponent');

        setAdvantageScore(newAdvantage);
        setPlayerCondition(turnData.player_condition ?? 'Stable');
        setOpponentCondition(turnData.opponent_condition ?? 'Stable');

        if (turnData.next_player_options?.length === 4) {
          setPlayerOptions(turnData.next_player_options);
        }

        if (isBattleOver) setWinner(battleWinner);

        // Update context trackers
        const newKeyMoments: string[] = turnData.key_moments_this_turn ?? [];
        if (newKeyMoments.length > 0) {
          setKeyMoments((prev) => [...prev, ...newKeyMoments]);
        }

        const abilityKey = detectAbilityKey(option.action_description, playerCypher.kit);
        if (abilityKey) {
          setPatternTracker((prev) => ({
            ...prev,
            [abilityKey]: (prev[abilityKey] ?? 0) + 1,
          }));
        }

        setMomentumTracker((prev) => {
          const updated = [...prev, turnWinner];
          return updated.slice(-3) as MomentumEntry[];
        });

        const lines: NarratedLine[] = narrData?.narration_lines ?? [
          { line: 'The battle continues.', character: 'both' },
        ];

        const record: TurnRecord = {
          turn_number: currentTurn,
          player_move: option.action_description,
          opponent_move: turnData.opponent_move ?? '?',
          advantage_delta: turnData.advantage_delta ?? 0,
          turn_winner: turnWinner,
          narration_summary: narrData?.turn_summary ?? `Turn ${currentTurn}.`,
          narration_lines: lines,
          expanded: false,
        };
        setTurnHistory((prev) => [...prev, record]);
        setCurrentTurn((prev) => prev + 1);

        setNarrationLines(lines);
        setCompletedLines([]);
        setCurrentLineIdx(0);
        setTypewriterText('');
        setSelectedMoveId(null);
        setTurnPhase('narrating');
      } catch (err) {
        console.warn('Turn error:', err);
        setTurnPhase('player_select');
        setSelectedMoveId(null);
      }
    },
    [turnPhase, opponentCypher, playerCypher, advantageScore, currentTurn, turnHistory, initiativeWinner, keyMoments, patternTracker, momentumTracker]
  );

  // ── Advantage bar ─────────────────────────────────────────────────────────

  const playerBarWidth = advantageAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0%', '0%', '50%'],
  });
  const opponentBarWidth = advantageAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['50%', '0%', '0%'],
  });
  const indicatorLeft = advantageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Matchmaking screen ────────────────────────────────────────────────────

  if (battlePhase === 'matchmaking') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.exitTopBtn} onPress={() => router.back()}>
            <Text style={styles.exitTopBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.matchmakingContainer}>
            <Animated.View style={[styles.scanRing, { opacity: loadingPulse }]} />
            <Animated.View style={[styles.scanRingInner, { opacity: loadingPulse }]} />
            <Text style={styles.matchmakingTitle}>ENTERING THE FRAMEWORK</Text>
            <Text style={styles.matchmakingStatus}>{matchmakingText}</Text>
            <View style={styles.matchmakingCypherBadge}>
              <Text style={styles.matchmakingCypherName}>{playerCypher?.name ?? 'Unknown'}</Text>
              <Text style={styles.matchmakingCypherSub}>{playerCypher?.sizeClass} · {playerCypher?.combatStyle}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!opponentCypher || !playerCypher) return null;

  const playerColor = getCypherColor(playerCypher);
  const opponentColor = getCypherColor(opponentCypher);

  // ── Initiative banner text ────────────────────────────────────────────────

  const initiativeBannerText = initiativeWinner === 'player'
    ? `${playerCypher.name} seizes the first move`
    : `${opponentCypher.name} moves before you can react`;

  // ── Battle screen ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.battleHeader}>
          <TouchableOpacity style={styles.exitTopBtn} onPress={() => router.back()}>
            <Text style={styles.exitTopBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.turnLabel}>Turn {Math.min(currentTurn, 7)} / 7</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Initiative banner — visible before turn 1 move is made */}
        {showInitiativeBanner && (
          <View style={styles.initiativeBanner}>
            <Text style={styles.initiativeBannerText}>{initiativeBannerText}</Text>
          </View>
        )}

        {/* Opponent blurred move display */}
        <View style={styles.opponentSelectArea}>
          <Text style={styles.opponentSelectLabel}>
            {turnPhase === 'opponent_thinking' ? '● SELECTING' : '◦ STANDBY'}
          </Text>
          <View style={styles.blurGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.blurCard, turnPhase === 'opponent_thinking' && styles.blurCardActive]}>
                <View style={styles.blurLine} />
                <View style={[styles.blurLine, { width: '55%', opacity: 0.4 }]} />
              </View>
            ))}
          </View>
        </View>

        {/* Characters + Advantage Bar */}
        <View style={styles.charactersSection}>
          {/* Player (left) */}
          <View style={styles.characterSlot}>
            <Animated.View style={[styles.portraitWrapper, { transform: [{ scale: playerBreathe }, { translateX: playerPush }] }]}>
              <CypherPortrait cypher={playerCypher} size={IMAGE_SIZE} />
            </Animated.View>
            <Text style={[styles.cypherNameLabel, { color: playerColor }]} numberOfLines={1}>{playerCypher.name}</Text>
            <View style={[styles.conditionBadge, { backgroundColor: (CONDITION_COLORS[playerCondition] ?? '#22c55e') + '20', borderColor: CONDITION_COLORS[playerCondition] ?? '#22c55e' }]}>
              <Text style={[styles.conditionText, { color: CONDITION_COLORS[playerCondition] ?? '#22c55e' }]}>{playerCondition}</Text>
            </View>
          </View>

          {/* Advantage bar */}
          <View style={styles.advantageColumn}>
            <View style={styles.advantageTrack}>
              <Animated.View style={[styles.advantageFillOpp, { width: opponentBarWidth }]} />
              <Animated.View style={[styles.advantageFillPlayer, { width: playerBarWidth }]} />
              <Animated.View style={[styles.advantageDot, { left: indicatorLeft }]} />
            </View>
          </View>

          {/* Opponent (right) */}
          <View style={styles.characterSlot}>
            <Animated.View style={[styles.portraitWrapper, { transform: [{ scale: opponentBreathe }, { translateX: opponentPush }] }]}>
              <CypherPortrait cypher={opponentCypher} size={IMAGE_SIZE} />
            </Animated.View>
            <Text style={[styles.cypherNameLabel, { color: opponentColor }]} numberOfLines={1}>{opponentCypher.name}</Text>
            <View style={[styles.conditionBadge, { backgroundColor: (CONDITION_COLORS[opponentCondition] ?? '#22c55e') + '20', borderColor: CONDITION_COLORS[opponentCondition] ?? '#22c55e' }]}>
              <Text style={[styles.conditionText, { color: CONDITION_COLORS[opponentCondition] ?? '#22c55e' }]}>{opponentCondition}</Text>
            </View>
          </View>
        </View>

        {/* Narration area — fixed height scrollable */}
        <View style={styles.narrationArea}>
          <ScrollView
            ref={narrationScrollRef}
            style={styles.narrationScroll}
            contentContainerStyle={styles.narrationContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Collapsed history for previous turns */}
            {turnHistory.map((record) => (
              <TurnHistoryRow
                key={record.turn_number}
                record={record}
                onToggle={() =>
                  setTurnHistory((prev) =>
                    prev.map((r) => r.turn_number === record.turn_number ? { ...r, expanded: !r.expanded } : r)
                  )
                }
              />
            ))}

            {/* Current turn live narration */}
            {completedLines.map((line, i) => (
              <Text key={`cur-${i}`} style={styles.narrationLineDimmed}>{line.line}</Text>
            ))}
            {typewriterText ? (
              <Text style={styles.narrationLineLive}>{typewriterText}</Text>
            ) : null}
            {turnPhase === 'resolving' && (
              <View style={styles.resolvingRow}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.resolvingText}>Resolving...</Text>
              </View>
            )}
            {turnPhase === 'player_select' && turnHistory.length === 0 && (
              <Text style={styles.narrationHint}>Choose your opening move.</Text>
            )}
          </ScrollView>
        </View>

        {/* Player move options — always visible */}
        <View style={styles.movesSection}>
          {turnPhase === 'player_select' ? (
            <View style={styles.movesGrid}>
              {playerOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.moveCard, selectedMoveId === opt.id && styles.moveCardSelected, opt.is_weakness_finisher && styles.moveCardFinisher]}
                  onPress={() => handleSelectMove(opt)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.moveCardText, opt.is_weakness_finisher && styles.moveCardFinisherText]}>
                    {opt.action_description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : turnPhase === 'opponent_thinking' ? (
            <View style={styles.lockInRow}>
              <Text style={styles.lockInText}>Move locked in — awaiting opponent...</Text>
            </View>
          ) : (
            <View style={styles.lockInRow}>
              <ActivityIndicator size="small" color="#4b5563" />
            </View>
          )}
        </View>

        {/* Battle End Modal */}
        <Modal visible={battlePhase === 'end'} transparent animationType="fade">
          <View style={styles.endOverlay}>
            <View style={styles.endCard}>
              <Text style={[styles.endTitle, winner === 'player' ? styles.endVictory : styles.endDefeat]}>
                {winner === 'player' ? 'VICTORY' : 'DEFEATED'}
              </Text>
              <Text style={styles.endCypherName}>
                {winner === 'player' ? playerCypher.name : opponentCypher.name}
              </Text>
              <Text style={styles.endFlavor}>
                {winner === 'player'
                  ? 'The Framework acknowledges your dominance.'
                  : 'The Framework will remember this defeat.'}
              </Text>
              <View style={styles.endButtons}>
                <TouchableOpacity style={styles.endBtn} onPress={() => router.replace('/framework')}>
                  <Text style={styles.endBtnText}>Return to Framework</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.endBtn, styles.endBtnSecondary]} onPress={() => router.replace('/')}>
                  <Text style={styles.endBtnText}>Go Home</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  safeArea: { flex: 1, display: 'flex', flexDirection: 'column' },

  exitTopBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0a1628', borderWidth: 1, borderColor: '#1e3a5f', justifyContent: 'center', alignItems: 'center' },
  exitTopBtnText: { fontSize: 14, color: '#6b7280' },

  // Matchmaking
  matchmakingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 32 },
  scanRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#1e3a5f' },
  scanRingInner: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#3b82f6' },
  matchmakingTitle: { fontSize: 13, fontWeight: '700', color: '#3b82f6', letterSpacing: 3 },
  matchmakingStatus: { fontSize: 16, color: '#9ca3af', letterSpacing: 0.5 },
  matchmakingCypherBadge: { marginTop: 16, alignItems: 'center', backgroundColor: '#0a1628', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: '#1e3a5f', gap: 4 },
  matchmakingCypherName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  matchmakingCypherSub: { fontSize: 12, color: '#6b7280' },

  // Battle header
  battleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  turnLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 1.5 },

  // Initiative banner
  initiativeBanner: { marginHorizontal: 16, marginBottom: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#05101e', borderRadius: 8, borderWidth: 1, borderColor: '#1e3a5f', alignItems: 'center' },
  initiativeBannerText: { fontSize: 12, color: '#60a5fa', fontStyle: 'italic', letterSpacing: 0.3 },

  // Opponent blurred cards
  opponentSelectArea: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  opponentSelectLabel: { fontSize: 10, fontWeight: '600', color: '#374151', letterSpacing: 2 },
  blurGrid: { flexDirection: 'row', gap: 8 },
  blurCard: { flex: 1, height: 44, backgroundColor: '#060e1a', borderRadius: 8, borderWidth: 1, borderColor: '#0f1f35', justifyContent: 'center', padding: 10, gap: 6 },
  blurCardActive: { borderColor: '#1e3a5f', backgroundColor: '#080f1d' },
  blurLine: { height: 5, width: '80%', borderRadius: 3, backgroundColor: '#1e3a5f', opacity: 0.7 },

  // Characters section
  charactersSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 0 },
  characterSlot: { flex: 1, alignItems: 'center', gap: 6 },
  portraitWrapper: { borderWidth: 2, borderRadius: 16, borderColor: 'transparent' },
  cypherNameLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  conditionBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  conditionText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  // Advantage bar
  advantageColumn: { width: 20, alignItems: 'center', justifyContent: 'flex-start', paddingTop: (IMAGE_SIZE / 2) - 4 },
  advantageTrack: { width: 4, height: IMAGE_SIZE + 4, backgroundColor: '#0f1f35', borderRadius: 2, overflow: 'visible', position: 'relative' },
  advantageFillPlayer: { position: 'absolute', bottom: 0, right: 0, width: 4, backgroundColor: '#3b82f6', borderRadius: 2 },
  advantageFillOpp: { position: 'absolute', top: 0, left: 0, width: 4, backgroundColor: '#ef4444', borderRadius: 2 },
  advantageDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffffff', top: '50%', marginTop: -5, marginLeft: -3, zIndex: 2 },

  // Narration — fixed height scrollable
  narrationArea: { marginHorizontal: 16, marginTop: 8, height: 108, backgroundColor: '#040c18', borderRadius: 12, borderWidth: 1, borderColor: '#0f1f35' },
  narrationScroll: { flex: 1 },
  narrationContent: { padding: 12, gap: 4 },
  narrationLineDimmed: { fontSize: 13, color: '#374151', lineHeight: 20, fontStyle: 'italic' },
  narrationLineLive: { fontSize: 14, color: '#d1d5db', lineHeight: 22 },
  narrationHint: { fontSize: 13, color: '#4b5563', fontStyle: 'italic' },
  resolvingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  resolvingText: { fontSize: 12, color: '#4b5563' },

  // Player moves
  movesSection: { paddingHorizontal: 16, marginTop: 10, flex: 1 },
  movesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moveCard: { width: (SCREEN_WIDTH - 40) / 2, minHeight: 64, backgroundColor: '#060e1a', borderRadius: 10, borderWidth: 1, borderColor: '#1e3a5f', padding: 12, justifyContent: 'center' },
  moveCardSelected: { borderColor: '#3b82f6', backgroundColor: '#071428' },
  moveCardFinisher: { borderColor: '#f59e0b', backgroundColor: '#0c0a03' },
  moveCardText: { fontSize: 12, color: '#93c5fd', lineHeight: 18 },
  moveCardFinisherText: { color: '#f59e0b' },
  lockInRow: { height: 60, justifyContent: 'center', alignItems: 'center' },
  lockInText: { fontSize: 13, color: '#4b5563', fontStyle: 'italic' },

  // End modal
  endOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  endCard: { width: '100%', backgroundColor: '#050e1a', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1e3a5f', gap: 12 },
  endTitle: { fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  endVictory: { color: '#3b82f6' },
  endDefeat: { color: '#ef4444' },
  endCypherName: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  endFlavor: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  endButtons: { width: '100%', gap: 10, marginTop: 4 },
  endBtn: { backgroundColor: '#0a1628', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e3a5f' },
  endBtnSecondary: { borderColor: '#0f1f35', backgroundColor: '#040a12' },
  endBtnText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
});
