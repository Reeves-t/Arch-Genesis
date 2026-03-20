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
import { BattleGrid, GridPos, HighlightedCell } from '../components/battle/BattleGrid';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_SIZE = Math.floor(SCREEN_WIDTH * 0.22);
const GRID_COLS = 13;
const GRID_ROWS = 7;
const CELL = 28;
const GRID_WIDTH = GRID_COLS * CELL; // 364

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
type MoveHighlightType = 'move' | 'attack';
type PoseType = 'idle' | 'attack' | 'defend';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getCypherColor(cypher: Cypher): string {
  return COMBAT_COLORS[cypher.combatStyle] ?? '#3b82f6';
}

function getCypherImage(
  cypher: Cypher,
  side: 'player' | 'opponent',
  currentPose: PoseType
): string | null {
  switch (currentPose) {
    case 'attack':
      return side === 'player'
        ? cypher.attackRightUrl ?? cypher.imageRightUrl ?? cypher.imageUrl ?? null
        : cypher.attackLeftUrl ?? cypher.imageLeftUrl ?? cypher.imageUrl ?? null;
    case 'defend':
      return side === 'player'
        ? cypher.defendRightUrl ?? cypher.imageRightUrl ?? cypher.imageUrl ?? null
        : cypher.defendLeftUrl ?? cypher.imageLeftUrl ?? cypher.imageUrl ?? null;
    default:
      return side === 'player'
        ? cypher.imageRightUrl ?? cypher.imageUrl ?? null
        : cypher.imageLeftUrl ?? cypher.imageUrl ?? null;
  }
}

function buildBattlePhase(turn: number): string {
  if (turn <= 2) return 'early';
  if (turn <= 4) return 'mid';
  return 'late';
}

function calcInitiative(cypher: Cypher): number {
  // Use derived stat when available
  if (cypher.stats?.initiative != null) return cypher.stats.initiative;
  // Legacy fallback
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

function chebyshev(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function getReachableCells(
  from: GridPos,
  range: number,
  type: MoveHighlightType,
  exclude?: GridPos,
): HighlightedCell[] {
  const cells: HighlightedCell[] = [];
  for (let x = 1; x <= GRID_COLS; x++) {
    for (let y = 1; y <= GRID_ROWS; y++) {
      if (exclude && exclude.x === x && exclude.y === y) continue;
      if (chebyshev(from, { x, y }) <= range && chebyshev(from, { x, y }) > 0) {
        cells.push({ x, y, type });
      }
    }
  }
  return cells;
}

function computeHighlights(
  option: PlayerOption,
  cypher: Cypher,
  playerPos: GridPos,
  opponentPos: GridPos,
): HighlightedCell[] {
  const kit = cypher.kit;
  const desc = option.action_description.toLowerCase();
  const defenseKey = kit.defense.toLowerCase();
  const passiveKey = kit.passive.toLowerCase();
  const special1Key = kit.special1.toLowerCase();
  const special2Key = kit.special2.toLowerCase();

  const isDefensive = desc.includes(defenseKey) || desc.includes(passiveKey);
  const isSpecial = desc.includes(special1Key) || desc.includes(special2Key);

  const movSpd = cypher.stats?.movement_speed ?? 3;
  const atkRange = cypher.stats?.attack_range ?? 4;
  const spcRange = cypher.stats?.special_range ?? 4;

  if (isDefensive) {
    return getReachableCells(playerPos, movSpd, 'move', opponentPos);
  }
  if (isSpecial) {
    return getReachableCells(playerPos, spcRange, 'attack', playerPos);
  }
  return getReachableCells(playerPos, atkRange, 'attack', playerPos);
}

function buildFallbackNPC(): Cypher {
  return {
    id: `npc-fallback-${Date.now()}`,
    name: 'Cipher-0',
    originLog: 'An unknown entity from the outer Framework layers.',
    description:
      'A methodical fighter that reads and adapts to its opponent. Fights with cold precision, opening conservatively then striking hard when patterns are established.',
    sizeClass: 'Standard',
    mobility: 'Balanced',
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
        style={{ width: size, height: size, borderRadius: 10 }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: color + '18',
        borderWidth: 1.5,
        borderColor: color + '55',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, color, fontWeight: '800' }}>
        {cypher.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ─── TurnHistoryRow ───────────────────────────────────────────────────────────

function TurnHistoryRow({ record, onToggle }: { record: TurnRecord; onToggle: () => void }) {
  const winnerLabel =
    record.turn_winner === 'player'
      ? 'You pressed'
      : record.turn_winner === 'opponent'
      ? 'Opponent took it'
      : 'Draw';

  return (
    <View style={histStyles.container}>
      <TouchableOpacity style={histStyles.header} onPress={onToggle} activeOpacity={0.7}>
        <Text style={histStyles.label}>
          T{record.turn_number}
          <Text
            style={[
              histStyles.result,
              record.turn_winner === 'player'
                ? histStyles.win
                : record.turn_winner === 'opponent'
                ? histStyles.loss
                : histStyles.draw,
            ]}
          >
            {' '}— {winnerLabel}
          </Text>
        </Text>
        <Text style={histStyles.chevron}>{record.expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {record.expanded && (
        <View style={histStyles.body}>
          {record.narration_lines.map((l, i) => (
            <Text key={i} style={histStyles.line}>
              {l.line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const histStyles = StyleSheet.create({
  container: { marginBottom: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  label: { fontSize: 10, color: '#4b5563', flex: 1 },
  result: { fontWeight: '600' },
  win: { color: '#3b82f6' },
  loss: { color: '#ef4444' },
  draw: { color: '#6b7280' },
  chevron: { fontSize: 9, color: '#374151', paddingLeft: 8 },
  body: { paddingTop: 4, paddingBottom: 4, gap: 4 },
  line: { fontSize: 11, color: '#374151', lineHeight: 16, fontStyle: 'italic' },
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
  const [initiativeWinner, setInitiativeWinner] = useState<InitiativeWinner>('player');
  const [showInitiativeBanner, setShowInitiativeBanner] = useState(false);

  // ── Grid state ────────────────────────────────────────────────────────────
  const [playerPos, setPlayerPos] = useState<GridPos>({ x: 1, y: 4 });
  const [opponentPos, setOpponentPos] = useState<GridPos>({ x: 13, y: 4 });
  const [selectedMove, setSelectedMove] = useState<PlayerOption | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<HighlightedCell[]>([]);
  const [targetCell, setTargetCell] = useState<GridPos | null>(null);
  const [executeReady, setExecuteReady] = useState(false);
  const [lastAttackFrom, setLastAttackFrom] = useState<GridPos | null>(null);
  const [lastAttackTo, setLastAttackTo] = useState<GridPos | null>(null);
  const [attackConnected, setAttackConnected] = useState(false);

  // ── Pose state ───────────────────────────────────────────────────────────
  const [playerPose, setPlayerPose] = useState<PoseType>('idle');
  const [opponentPose, setOpponentPose] = useState<PoseType>('idle');

  // ── Narration state ──────────────────────────────────────────────────────
  const [narrationLines, setNarrationLines] = useState<NarratedLine[]>([]);
  const [completedLines, setCompletedLines] = useState<NarratedLine[]>([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [typewriterText, setTypewriterText] = useState('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const narrationScrollRef = useRef<ScrollView>(null);

  // ── Matchmaking state ─────────────────────────────────────────────────────
  const MATCHMAKING_TEXTS = ['Scanning the Framework...', 'Locating opponent...', 'Preparing battlefield...'];
  const [matchmakingText, setMatchmakingText] = useState(MATCHMAKING_TEXTS[0]);

  // ── Animations ───────────────────────────────────────────────────────────
  const playerBreathe = useRef(new Animated.Value(1)).current;
  const opponentBreathe = useRef(new Animated.Value(1)).current;
  const playerPush = useRef(new Animated.Value(0)).current;
  const opponentPush = useRef(new Animated.Value(0)).current;
  const advantageAnim = useRef(new Animated.Value(0.5)).current;
  const loadingPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(playerBreathe, { toValue: 1.03, duration: 2200, useNativeDriver: true }),
        Animated.timing(playerBreathe, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opponentBreathe, { toValue: 1.03, duration: 2500, useNativeDriver: true }),
          Animated.timing(opponentBreathe, { toValue: 1, duration: 2500, useNativeDriver: true }),
        ])
      ).start();
    }, 1200);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(loadingPulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (battlePhase !== 'matchmaking') return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % MATCHMAKING_TEXTS.length;
      setMatchmakingText(MATCHMAKING_TEXTS[idx]);
    }, 1000);
    return () => clearInterval(interval);
  }, [battlePhase]);

  useEffect(() => {
    if (battlePhase !== 'matchmaking' || !playerCypher) return;
    const run = async () => {
      try {
        const [npc] = await Promise.all([
          generateNPC(),
          new Promise<void>((res) => setTimeout(res, 3000)),
        ]);
        const playerInit = calcInitiative(playerCypher);
        const npcInit = calcInitiative(npc);
        const initWinner: InitiativeWinner =
          playerInit > npcInit ? 'player' : npcInit > playerInit ? 'opponent' : Math.random() < 0.5 ? 'player' : 'opponent';
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
        const initWinner: InitiativeWinner =
          playerInit > npcInit ? 'player' : npcInit > playerInit ? 'opponent' : Math.random() < 0.5 ? 'player' : 'opponent';
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
        Animated.timing(playerPush, { toValue: 8, duration: 120, useNativeDriver: true }),
        Animated.timing(playerPush, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    } else if (line.character === 'opponent') {
      Animated.sequence([
        Animated.timing(opponentPush, { toValue: -8, duration: 120, useNativeDriver: true }),
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
          narrationScrollRef.current?.scrollToEnd({ animated: true });
        }, 600);
        return () => clearTimeout(holdTimeout);
      }
    }, 26);

    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [currentLineIdx, turnPhase, battlePhase]);

  // ── API calls ────────────────────────────────────────────────────────────

  async function generateNPC(): Promise<Cypher> {
    const { data, error } = await supabase.functions.invoke('battle-framework-master', {
      body: { mode: 'generate_npc' },
    });
    if (error || !data) throw error ?? new Error('No NPC data');
    return {
      id: `npc-${Date.now()}`,
      name: data.name ?? 'Unknown',
      originLog: data.originLog,
      description: data.description ?? 'An unknown entity.',
      sizeClass: data.sizeClass ?? 'Standard',
      mobility: data.mobility ?? 'Balanced',
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

  // ── Phase 1: Pick a move card ─────────────────────────────────────────────

  const handlePickMove = useCallback(
    (option: PlayerOption) => {
      if (turnPhase !== 'player_select' || !playerCypher || !opponentCypher) return;
      setShowInitiativeBanner(false);
      setSelectedMove(option);
      setTargetCell(null);
      setExecuteReady(false);
      const cells = computeHighlights(option, playerCypher, playerPos, opponentPos);
      setHighlightedCells(cells);
    },
    [turnPhase, playerCypher, opponentCypher, playerPos, opponentPos]
  );

  // ── Phase 2: Pick a target cell ───────────────────────────────────────────

  const handleCellPress = useCallback(
    (pos: GridPos) => {
      if (!selectedMove || turnPhase !== 'player_select') return;
      const isHighlighted = highlightedCells.some((h) => h.x === pos.x && h.y === pos.y);
      if (!isHighlighted) return;
      setTargetCell(pos);
      setExecuteReady(true);
    },
    [selectedMove, highlightedCells, turnPhase]
  );

  // ── Phase 3: Execute turn ─────────────────────────────────────────────────

  const handleExecute = useCallback(async () => {
    if (!executeReady || !selectedMove || !targetCell || !opponentCypher || !playerCypher) return;

    setExecuteReady(false);
    setHighlightedCells([]);
    setTargetCell(null);
    setTurnPhase('opponent_thinking');

    await new Promise((res) => setTimeout(res, 1400));
    setTurnPhase('resolving');

    try {
      const bPhase = buildBattlePhase(currentTurn);

      const { data: turnData, error: turnError } = await supabase.functions.invoke(
        'battle-framework-master',
        {
          body: {
            mode: 'resolve_turn',
            player_cypher: playerCypher,
            opponent_cypher: opponentCypher,
            player_position: playerPos,
            opponent_position: opponentPos,
            target_cell: targetCell,
            advantage_score: advantageScore,
            current_turn: currentTurn,
            move_history: turnHistory.map((t) => ({
              turn_number: t.turn_number,
              player_move: t.player_move,
              opponent_move: t.opponent_move,
              advantage_delta: t.advantage_delta,
              turn_winner: t.turn_winner,
              narration_summary: t.narration_summary,
            })),
            player_selected_move: selectedMove.action_description,
            battle_phase: bPhase,
            initiative_winner: initiativeWinner,
          },
        }
      );

      if (turnError || !turnData) throw turnError ?? new Error('No turn data');

      // Update positions from AI response
      const newPlayerPos: GridPos = turnData.player_new_position ?? playerPos;
      const newOpponentPos: GridPos = turnData.opponent_new_position ?? opponentPos;
      const didConnect: boolean = turnData.attack_connected ?? true;

      // Animate attack line
      setLastAttackFrom(newPlayerPos);
      setLastAttackTo(newOpponentPos);
      setAttackConnected(didConnect);

      // Delay position update for animation
      await new Promise((res) => setTimeout(res, 300));
      setPlayerPos(newPlayerPos);
      setOpponentPos(newOpponentPos);

      // Determine pose based on selected move description
      const moveDesc = selectedMove.action_description.toLowerCase();
      const kit = playerCypher.kit;
      const isDefensiveMove = moveDesc.includes(kit.defense.toLowerCase()) || moveDesc.includes(kit.passive.toLowerCase());
      const playerMovePose: PoseType = isDefensiveMove ? 'defend' : 'attack';
      setPlayerPose(playerMovePose);
      setTimeout(() => setPlayerPose('idle'), 2000);

      // Opponent pose based on their move description
      const oppMoveDesc = (turnData.opponent_move ?? '').toLowerCase();
      const oppKit = opponentCypher.kit;
      const isOppDefensive = oppMoveDesc.includes(oppKit.defense.toLowerCase()) || oppMoveDesc.includes(oppKit.passive.toLowerCase());
      const opponentMovePose: PoseType = isOppDefensive ? 'defend' : 'attack';
      setOpponentPose(opponentMovePose);
      setTimeout(() => setOpponentPose('idle'), 2000);

      const { data: narrData } = await supabase.functions.invoke('battle-narrator', {
        body: {
          turn_result: {
            ...turnData,
            player_selected_move: selectedMove.action_description,
            player_position: playerPos,
            opponent_position: opponentPos,
            player_new_position: newPlayerPos,
            opponent_new_position: newOpponentPos,
            attack_connected: didConnect,
          },
          player_cypher: playerCypher,
          opponent_cypher: opponentCypher,
          move_history: turnHistory.map((t) => ({
            turn_number: t.turn_number,
            narration_summary: t.narration_summary,
          })),
          current_turn: currentTurn,
          battle_phase: bPhase,
          initiative_winner: initiativeWinner,
          turn_winner: turnData.turn_winner ?? 'draw',
          last_turn_context: turnData.last_turn_context ?? null,
          opponent_move_reasoning: turnData.opponent_move_reasoning ?? null,
        },
      });

      const newAdvantage = turnData.new_advantage_score ?? advantageScore;
      const turnWinner = turnData.turn_winner ?? 'draw';
      const isBattleOver = turnData.is_battle_over ?? false;
      const battleWinner = turnData.winner ?? (newAdvantage >= 0 ? 'player' : 'opponent');

      setAdvantageScore(newAdvantage);
      setPlayerCondition(turnData.player_condition ?? 'Stable');
      setOpponentCondition(turnData.opponent_condition ?? 'Stable');

      if (turnData.next_player_options?.length === 4) {
        setPlayerOptions(turnData.next_player_options);
      }

      if (isBattleOver) setWinner(battleWinner);

      const lines: NarratedLine[] = narrData?.narration_lines ?? [
        { line: 'The battle continues.', character: 'both' },
      ];

      const record: TurnRecord = {
        turn_number: currentTurn,
        player_move: selectedMove.action_description,
        opponent_move: turnData.opponent_move ?? '?',
        advantage_delta: turnData.advantage_delta ?? 0,
        turn_winner: turnWinner,
        narration_summary: narrData?.turn_summary ?? `Turn ${currentTurn}.`,
        narration_lines: lines,
        expanded: false,
      };
      setTurnHistory((prev) => [...prev, record]);
      setCurrentTurn((prev) => prev + 1);
      setSelectedMove(null);

      setNarrationLines(lines);
      setCompletedLines([]);
      setCurrentLineIdx(0);
      setTypewriterText('');
      setTurnPhase('narrating');
    } catch (err) {
      console.warn('Turn error:', err);
      setTurnPhase('player_select');
      setSelectedMove(null);
    }
  }, [
    executeReady, selectedMove, targetCell, opponentCypher, playerCypher,
    playerPos, opponentPos, advantageScore, currentTurn, turnHistory, initiativeWinner,
  ]);

  // ── Advantage bar interpolations ──────────────────────────────────────────

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
          <TouchableOpacity style={styles.exitBtn} onPress={() => router.back()}>
            <Text style={styles.exitBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.matchmakingContainer}>
            <Animated.View style={[styles.scanRing, { opacity: loadingPulse }]} />
            <Animated.View style={[styles.scanRingInner, { opacity: loadingPulse }]} />
            <Text style={styles.matchmakingTitle}>ENTERING THE FRAMEWORK</Text>
            <Text style={styles.matchmakingStatus}>{matchmakingText}</Text>
            <View style={styles.matchmakingBadge}>
              <Text style={styles.matchmakingName}>{playerCypher?.name ?? 'Unknown'}</Text>
              <Text style={styles.matchmakingSub}>
                {playerCypher?.sizeClass} · {playerCypher?.combatStyle}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!opponentCypher || !playerCypher) return null;

  const playerColor = getCypherColor(playerCypher);
  const opponentColor = getCypherColor(opponentCypher);
  const isWaitingForMove = turnPhase === 'player_select' && !selectedMove;
  const isWaitingForTarget = turnPhase === 'player_select' && !!selectedMove && !executeReady;
  const canExecute = turnPhase === 'player_select' && executeReady;

  const initiativeBannerText =
    initiativeWinner === 'player'
      ? `${playerCypher.name} seizes first move`
      : `${opponentCypher.name} moves before you react`;

  // ── Battle screen ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.exitBtn} onPress={() => router.back()}>
            <Text style={styles.exitBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.turnLabel}>Turn {Math.min(currentTurn, 7)} / 7</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Initiative banner ── */}
        {showInitiativeBanner && (
          <View style={styles.initiativeBanner}>
            <Text style={styles.initiativeBannerText}>{initiativeBannerText}</Text>
          </View>
        )}

        {/* ── Portraits + Advantage ── */}
        <View style={styles.portraitsRow}>
          {/* Player */}
          <View style={styles.characterSlot}>
            <Animated.View
              style={{ transform: [{ scale: playerBreathe }, { translateX: playerPush }] }}
            >
              <CypherPortrait cypher={playerCypher} size={PORTRAIT_SIZE} />
            </Animated.View>
            <Text style={[styles.cypherName, { color: playerColor }]} numberOfLines={1}>
              {playerCypher.name}
            </Text>
            <View
              style={[
                styles.conditionBadge,
                {
                  backgroundColor: (CONDITION_COLORS[playerCondition] ?? '#22c55e') + '20',
                  borderColor: CONDITION_COLORS[playerCondition] ?? '#22c55e',
                },
              ]}
            >
              <Text style={[styles.conditionText, { color: CONDITION_COLORS[playerCondition] ?? '#22c55e' }]}>
                {playerCondition}
              </Text>
            </View>
          </View>

          {/* Advantage bar (vertical) */}
          <View style={styles.advantageCol}>
            <View style={styles.advantageTrack}>
              <Animated.View style={[styles.advFillOpp, { width: opponentBarWidth }]} />
              <Animated.View style={[styles.advFillPlayer, { width: playerBarWidth }]} />
              <Animated.View style={[styles.advDot, { left: indicatorLeft }]} />
            </View>
          </View>

          {/* Opponent */}
          <View style={styles.characterSlot}>
            <Animated.View
              style={{ transform: [{ scale: opponentBreathe }, { translateX: opponentPush }] }}
            >
              <CypherPortrait cypher={opponentCypher} size={PORTRAIT_SIZE} />
            </Animated.View>
            <Text style={[styles.cypherName, { color: opponentColor }]} numberOfLines={1}>
              {opponentCypher.name}
            </Text>
            <View
              style={[
                styles.conditionBadge,
                {
                  backgroundColor: (CONDITION_COLORS[opponentCondition] ?? '#22c55e') + '20',
                  borderColor: CONDITION_COLORS[opponentCondition] ?? '#22c55e',
                },
              ]}
            >
              <Text style={[styles.conditionText, { color: CONDITION_COLORS[opponentCondition] ?? '#22c55e' }]}>
                {opponentCondition}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Battle Grid ── */}
        <View style={styles.gridSection}>
          {/* Phase hint above grid */}
          <Text style={styles.gridHint}>
            {isWaitingForMove && 'SELECT A MOVE'}
            {isWaitingForTarget && 'TAP A HIGHLIGHTED CELL'}
            {canExecute && 'READY — TAP EXECUTE'}
            {turnPhase === 'opponent_thinking' && '● OPPONENT CHOOSING'}
            {turnPhase === 'resolving' && '◦ RESOLVING TURN'}
            {turnPhase === 'narrating' && '◦ NARRATING'}
          </Text>
          <BattleGrid
            playerPos={playerPos}
            opponentPos={opponentPos}
            highlightedCells={highlightedCells}
            targetCell={targetCell}
            onCellPress={handleCellPress}
            lastAttackFrom={lastAttackFrom}
            lastAttackTo={lastAttackTo}
            attackConnected={attackConnected}
            playerColor={playerColor}
            opponentColor={opponentColor}
            playerImageUrl={getCypherImage(playerCypher, 'player', playerPose)}
            opponentImageUrl={getCypherImage(opponentCypher, 'opponent', opponentPose)}
            playerModelUrl={playerCypher.modelUrl ?? null}
            opponentModelUrl={opponentCypher.modelUrl ?? null}
            playerInitial={playerCypher.name.charAt(0).toUpperCase()}
            opponentInitial={opponentCypher.name.charAt(0).toUpperCase()}
          />
        </View>

        {/* ── Narration ── */}
        <View style={styles.narrationArea}>
          <ScrollView
            ref={narrationScrollRef}
            style={styles.narrationScroll}
            contentContainerStyle={styles.narrationContent}
            showsVerticalScrollIndicator={false}
          >
            {turnHistory.map((record) => (
              <TurnHistoryRow
                key={record.turn_number}
                record={record}
                onToggle={() =>
                  setTurnHistory((prev) =>
                    prev.map((r) =>
                      r.turn_number === record.turn_number ? { ...r, expanded: !r.expanded } : r
                    )
                  )
                }
              />
            ))}
            {completedLines.map((line, i) => (
              <Text key={`cur-${i}`} style={styles.narrationDimmed}>
                {line.line}
              </Text>
            ))}
            {typewriterText ? (
              <Text style={styles.narrationLive}>{typewriterText}</Text>
            ) : null}
            {turnPhase === 'resolving' && (
              <View style={styles.resolvingRow}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.resolvingText}>Resolving...</Text>
              </View>
            )}
            {turnPhase === 'player_select' && turnHistory.length === 0 && !selectedMove && (
              <Text style={styles.narrationHint}>Choose your opening move.</Text>
            )}
          </ScrollView>
        </View>

        {/* ── Move Cards ── */}
        <View style={styles.movesSection}>
          {turnPhase === 'player_select' ? (
            <View style={styles.movesGrid}>
              {playerOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.moveCard,
                    selectedMove?.id === opt.id && styles.moveCardSelected,
                    opt.is_weakness_finisher && styles.moveCardFinisher,
                  ]}
                  onPress={() => handlePickMove(opt)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.moveCardText,
                      opt.is_weakness_finisher && styles.moveCardFinisherText,
                    ]}
                    numberOfLines={3}
                  >
                    {opt.action_description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : turnPhase === 'opponent_thinking' ? (
            <View style={styles.lockInRow}>
              <Text style={styles.lockInText}>Move locked — awaiting opponent...</Text>
            </View>
          ) : (
            <View style={styles.lockInRow}>
              <ActivityIndicator size="small" color="#4b5563" />
            </View>
          )}
        </View>

        {/* ── Execute Button ── */}
        {turnPhase === 'player_select' && (
          <TouchableOpacity
            style={[styles.executeBtn, !canExecute && styles.executeBtnDisabled]}
            onPress={handleExecute}
            disabled={!canExecute}
            activeOpacity={0.85}
          >
            <Text style={[styles.executeBtnText, !canExecute && styles.executeBtnTextDisabled]}>
              {canExecute ? 'EXECUTE' : selectedMove ? 'SELECT TARGET' : 'SELECT MOVE'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Battle End Modal ── */}
        <Modal visible={battlePhase === 'end'} transparent animationType="fade">
          <View style={styles.endOverlay}>
            <View style={styles.endCard}>
              <Text
                style={[
                  styles.endTitle,
                  winner === 'player' ? styles.endVictory : styles.endDefeat,
                ]}
              >
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
                <TouchableOpacity
                  style={[styles.endBtn, styles.endBtnSecondary]}
                  onPress={() => router.replace('/')}
                >
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
  safeArea: { flex: 1, flexDirection: 'column' },

  exitBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0a1628',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitBtnText: { fontSize: 13, color: '#6b7280' },

  // Matchmaking
  matchmakingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 32 },
  scanRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#1e3a5f' },
  scanRingInner: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#3b82f6' },
  matchmakingTitle: { fontSize: 13, fontWeight: '700', color: '#3b82f6', letterSpacing: 3 },
  matchmakingStatus: { fontSize: 15, color: '#9ca3af', letterSpacing: 0.5 },
  matchmakingBadge: { marginTop: 16, alignItems: 'center', backgroundColor: '#0a1628', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: '#1e3a5f', gap: 4 },
  matchmakingName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  matchmakingSub: { fontSize: 12, color: '#6b7280' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  turnLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', letterSpacing: 1.5 },

  // Initiative banner
  initiativeBanner: { marginHorizontal: 16, marginBottom: 4, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: '#05101e', borderRadius: 6, borderWidth: 1, borderColor: '#1e3a5f', alignItems: 'center' },
  initiativeBannerText: { fontSize: 11, color: '#60a5fa', fontStyle: 'italic', letterSpacing: 0.3 },

  // Portraits row
  portraitsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  characterSlot: { flex: 1, alignItems: 'center', gap: 4 },
  cypherName: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  conditionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  conditionText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  // Advantage bar
  advantageCol: { width: 16, alignItems: 'center', justifyContent: 'flex-start', paddingTop: PORTRAIT_SIZE / 2 - 4 },
  advantageTrack: { width: 3, height: PORTRAIT_SIZE + 4, backgroundColor: '#0f1f35', borderRadius: 2, overflow: 'visible', position: 'relative' },
  advFillPlayer: { position: 'absolute', bottom: 0, right: 0, width: 3, backgroundColor: '#3b82f6', borderRadius: 2 },
  advFillOpp: { position: 'absolute', top: 0, left: 0, width: 3, backgroundColor: '#ef4444', borderRadius: 2 },
  advDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff', top: '50%', marginTop: -4, marginLeft: -2.5, zIndex: 2 },

  // Grid section
  gridSection: { alignItems: 'center', paddingVertical: 6 },
  gridHint: { fontSize: 9, fontWeight: '600', color: '#374151', letterSpacing: 1.8, marginBottom: 5 },

  // Narration
  narrationArea: { marginHorizontal: 12, marginTop: 6, height: 80, backgroundColor: '#040c18', borderRadius: 10, borderWidth: 1, borderColor: '#0f1f35' },
  narrationScroll: { flex: 1 },
  narrationContent: { padding: 10, gap: 3 },
  narrationDimmed: { fontSize: 11, color: '#374151', lineHeight: 17, fontStyle: 'italic' },
  narrationLive: { fontSize: 12, color: '#d1d5db', lineHeight: 20 },
  narrationHint: { fontSize: 11, color: '#4b5563', fontStyle: 'italic' },
  resolvingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolvingText: { fontSize: 11, color: '#4b5563' },

  // Moves grid
  movesSection: { paddingHorizontal: 12, marginTop: 6 },
  movesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moveCard: {
    width: (SCREEN_WIDTH - 30) / 2,
    minHeight: 52,
    backgroundColor: '#060e1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    padding: 10,
    justifyContent: 'center',
  },
  moveCardSelected: { borderColor: '#3b82f6', backgroundColor: '#071428' },
  moveCardFinisher: { borderColor: '#f59e0b', backgroundColor: '#0c0a03' },
  moveCardText: { fontSize: 11, color: '#93c5fd', lineHeight: 16 },
  moveCardFinisherText: { color: '#f59e0b' },
  lockInRow: { height: 52, justifyContent: 'center', alignItems: 'center' },
  lockInText: { fontSize: 12, color: '#4b5563', fontStyle: 'italic' },

  // Execute button
  executeBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  executeBtnDisabled: {
    backgroundColor: '#0a1628',
    borderColor: '#1e3a5f',
    opacity: 0.6,
  },
  executeBtnText: { fontSize: 13, fontWeight: '800', color: '#ffffff', letterSpacing: 2 },
  executeBtnTextDisabled: { color: '#374151' },

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
