import React, { useRef, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Image, Text, PanResponder } from 'react-native';
import CypherModel3D from './CypherModel3D';

const COLS = 13;
const ROWS = 7;
const CELL = 28;

const CHAR_WIDTH = 72;
const CHAR_HEIGHT = 90;

export interface GridPos {
  x: number; // 1–13
  y: number; // 1–7
}

export interface HighlightedCell {
  x: number;
  y: number;
  type: 'move' | 'attack';
}

interface BattleGridProps {
  playerPos: GridPos;
  opponentPos: GridPos;
  highlightedCells: HighlightedCell[];
  targetCell: GridPos | null;
  onCellPress: (pos: GridPos) => void;
  lastAttackFrom?: GridPos | null;
  lastAttackTo?: GridPos | null;
  attackConnected?: boolean;
  playerColor?: string;
  opponentColor?: string;
  playerImageUrl?: string | null;
  opponentImageUrl?: string | null;
  playerModelUrl?: string | null;
  opponentModelUrl?: string | null;
  playerInitial?: string;
  opponentInitial?: string;
  // Path movement props
  turnPhase: 'move' | 'action' | 'resolving' | 'narrating';
  movementPath: GridPos[];
  moveDestination: GridPos | null;
  onPathUpdate: (path: GridPos[]) => void;
  onMoveConfirmed: (destination: GridPos) => void;
  playerMovementSpeed: number;
  playerWebViewRef?: React.RefObject<any>;
  opponentWebViewRef?: React.RefObject<any>;
}

// Module-level helpers (no state dependency)
function getDirectionBetween(from: GridPos, to: GridPos): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx > 0 && dy === 0) return 'right';
  if (dx < 0 && dy === 0) return 'left';
  if (dx === 0 && dy < 0) return 'up';
  if (dx === 0 && dy > 0) return 'down';
  if (dx > 0 && dy < 0) return 'up-right';
  if (dx > 0 && dy > 0) return 'down-right';
  if (dx < 0 && dy < 0) return 'up-left';
  if (dx < 0 && dy > 0) return 'down-left';
  return 'right';
}

function getArrowForDirection(dir: string): string {
  const arrows: Record<string, string> = {
    right: '→', left: '←', up: '↑', down: '↓',
    'up-right': '↗', 'up-left': '↖', 'down-right': '↘', 'down-left': '↙',
  };
  return arrows[dir] ?? '·';
}

function chebyshev(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function BattleGrid({
  playerPos,
  opponentPos,
  highlightedCells,
  targetCell,
  onCellPress,
  lastAttackFrom,
  lastAttackTo,
  attackConnected,
  playerColor = '#3b82f6',
  opponentColor = '#ef4444',
  playerImageUrl,
  opponentImageUrl,
  playerModelUrl,
  opponentModelUrl,
  playerInitial = '?',
  opponentInitial = '?',
  turnPhase,
  movementPath,
  moveDestination,
  onPathUpdate,
  onMoveConfirmed,
  playerMovementSpeed,
  playerWebViewRef,
  opponentWebViewRef,
}: BattleGridProps) {

  // ── Animated values ──────────────────────────────────────────────────────
  const playerPulse = useRef(new Animated.Value(1)).current;
  const opponentPulse = useRef(new Animated.Value(1)).current;
  const attackLineOpacity = useRef(new Animated.Value(0)).current;
  const playerAttackOffset = useRef(new Animated.Value(0)).current;
  const opponentShake = useRef(new Animated.Value(0)).current;
  const destinationPulse = useRef(new Animated.Value(1)).current;

  // ── Grid layout for touch→cell coordinate conversion ────────────────────
  const gridRef = useRef<View>(null);
  const gridOffsetRef = useRef({ x: 0, y: 0 });

  const measureGrid = () => {
    gridRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      gridOffsetRef.current = { x: pageX, y: pageY };
    });
  };

  const screenToCell = (pageX: number, pageY: number): GridPos | null => {
    const relX = pageX - gridOffsetRef.current.x;
    const relY = pageY - gridOffsetRef.current.y;
    const cellX = Math.floor(relX / CELL) + 1;
    const cellY = Math.floor(relY / CELL) + 1;
    if (cellX >= 1 && cellX <= COLS && cellY >= 1 && cellY <= ROWS) {
      return { x: cellX, y: cellY };
    }
    return null;
  };

  // ── Mutable refs for PanResponder (avoids stale closure problem) ─────────
  const pathRef = useRef<GridPos[]>([]);
  const turnPhaseRef = useRef(turnPhase);
  const playerPosRef = useRef(playerPos);
  const playerSpeedRef = useRef(playerMovementSpeed);
  const onPathUpdateRef = useRef(onPathUpdate);
  const onMoveConfirmedRef = useRef(onMoveConfirmed);

  useEffect(() => { turnPhaseRef.current = turnPhase; }, [turnPhase]);
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { playerSpeedRef.current = playerMovementSpeed; }, [playerMovementSpeed]);
  useEffect(() => { onPathUpdateRef.current = onPathUpdate; }, [onPathUpdate]);
  useEffect(() => { onMoveConfirmedRef.current = onMoveConfirmed; }, [onMoveConfirmed]);
  useEffect(() => { pathRef.current = movementPath; }, [movementPath]);

  // ── PanResponder — drag to trace movement path ───────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (turnPhaseRef.current !== 'move') return false;
        const cell = screenToCell(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (!cell) return false;
        // Only activate when drag starts on the player's current cell
        return cell.x === playerPosRef.current.x && cell.y === playerPosRef.current.y;
      },
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        const start = [playerPosRef.current];
        pathRef.current = start;
        onPathUpdateRef.current(start);
      },
      onPanResponderMove: (evt) => {
        const cell = screenToCell(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (!cell) return;

        const currentPath = pathRef.current;
        const lastCell = currentPath[currentPath.length - 1];

        if (!lastCell || (cell.x === lastCell.x && cell.y === lastCell.y)) return;

        // Must be adjacent to last traced cell (Chebyshev distance 1)
        if (chebyshev(cell, lastCell) > 1) return;

        // Retracing: trim path back to this cell
        const existingIdx = currentPath.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (existingIdx !== -1) {
          const trimmed = currentPath.slice(0, existingIdx + 1);
          pathRef.current = trimmed;
          onPathUpdateRef.current(trimmed);
          return;
        }

        // Movement budget: steps taken = path.length - 1 (start cell doesn't cost)
        if (currentPath.length - 1 >= playerSpeedRef.current) return;

        // Also check total range from starting position
        if (chebyshev(cell, playerPosRef.current) > playerSpeedRef.current) return;

        const newPath = [...currentPath, cell];
        pathRef.current = newPath;
        onPathUpdateRef.current(newPath);
      },
      onPanResponderRelease: () => {
        const path = pathRef.current;
        if (path.length > 0) {
          onMoveConfirmedRef.current(path[path.length - 1]);
        }
      },
    })
  ).current;

  // ── Idle pulse loops ─────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(playerPulse, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(playerPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opponentPulse, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
          Animated.timing(opponentPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // Destination dot pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(destinationPulse, { toValue: 1.35, duration: 480, useNativeDriver: true }),
        Animated.timing(destinationPulse, { toValue: 0.85, duration: 480, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Attack line flash + character animation ──────────────────────────────
  useEffect(() => {
    if (!lastAttackFrom || !lastAttackTo) return;
    attackLineOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(attackLineOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(attackLineOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    const direction = lastAttackFrom.x < lastAttackTo.x ? 8 : -8;
    Animated.sequence([
      Animated.timing(playerAttackOffset, { toValue: direction, duration: 100, useNativeDriver: true }),
      Animated.timing(playerAttackOffset, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    if (attackConnected) {
      Animated.sequence([
        Animated.timing(opponentShake, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(opponentShake, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(opponentShake, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(opponentShake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [lastAttackFrom, lastAttackTo]);

  // ── Attack line geometry ─────────────────────────────────────────────────
  let attackLine: { midX: number; midY: number; length: number; angle: number } | null = null;
  if (lastAttackFrom && lastAttackTo) {
    const x1 = (lastAttackFrom.x - 1) * CELL + CELL / 2;
    const y1 = (lastAttackFrom.y - 1) * CELL + CELL / 2;
    const x2 = (lastAttackTo.x - 1) * CELL + CELL / 2;
    const y2 = (lastAttackTo.y - 1) * CELL + CELL / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    attackLine = {
      midX: (x1 + x2) / 2,
      midY: (y1 + y2) / 2,
      length: Math.sqrt(dx * dx + dy * dy),
      angle: Math.atan2(dy, dx) * (180 / Math.PI),
    };
  }

  // ── Cell highlight sets ──────────────────────────────────────────────────
  const highlightMap = new Map(highlightedCells.map((h) => [`${h.x},${h.y}`, h.type]));

  const moveRangeSet = useMemo(() => {
    if (turnPhase !== 'move') return new Set<string>();
    const set = new Set<string>();
    for (let x = 1; x <= COLS; x++) {
      for (let y = 1; y <= ROWS; y++) {
        const dist = chebyshev({ x, y }, playerPos);
        if (dist > 0 && dist <= playerMovementSpeed) {
          if (!(x === opponentPos.x && y === opponentPos.y)) {
            set.add(`${x},${y}`);
          }
        }
      }
    }
    return set;
  }, [turnPhase, playerPos, opponentPos, playerMovementSpeed]);

  const pathCellSet = useMemo(
    () => new Set(movementPath.map(c => `${c.x},${c.y}`)),
    [movementPath]
  );

  // ── Character positions in pixels ────────────────────────────────────────
  const playerCellX = (playerPos.x - 1) * CELL + CELL / 2;
  const playerCellY = (playerPos.y - 1) * CELL + CELL / 2;
  const opponentCellX = (opponentPos.x - 1) * CELL + CELL / 2;
  const opponentCellY = (opponentPos.y - 1) * CELL + CELL / 2;

  // ── Path dots + arrows ───────────────────────────────────────────────────
  const renderPath = () => {
    if (movementPath.length <= 1) return null;
    return movementPath.slice(1).map((cell, idx) => {
      const index = idx + 1;
      const isDestination = index === movementPath.length - 1;
      const cx = (cell.x - 1) * CELL + CELL / 2;
      const cy = (cell.y - 1) * CELL + CELL / 2;
      const prevCell = movementPath[index - 1];
      const dir = getDirectionBetween(prevCell, cell);
      const arrow = getArrowForDirection(dir);

      return (
        <View
          key={`path-${index}`}
          pointerEvents="none"
          style={{ position: 'absolute', left: cx - 8, top: cy - 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}
        >
          {isDestination ? (
            <Animated.View style={[styles.destinationDot, { transform: [{ scale: destinationPulse }] }]} />
          ) : (
            <View style={styles.pathDot} />
          )}
          <Text style={styles.pathArrow}>{arrow}</Text>
        </View>
      );
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View
      ref={gridRef}
      onLayout={measureGrid}
      style={styles.gridContainer}
      {...panResponder.panHandlers}
    >
      {/* ── Grid cells ── */}
      {Array.from({ length: ROWS }, (_, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {Array.from({ length: COLS }, (_, colIdx) => {
            const x = colIdx + 1;
            const y = rowIdx + 1;
            const hlType = highlightMap.get(`${x},${y}`);
            const isMoveRange = moveRangeSet.has(`${x},${y}`);
            const isPathCell = pathCellSet.has(`${x},${y}`);
            const isTargeted = targetCell?.x === x && targetCell?.y === y;

            return (
              <TouchableOpacity
                key={colIdx}
                style={[
                  styles.cell,
                  isMoveRange && styles.cellMoveRange,
                  isPathCell && styles.cellPath,
                  hlType === 'move' && styles.cellMove,
                  hlType === 'attack' && styles.cellAttack,
                  isTargeted && styles.cellTarget,
                ]}
                onPress={() => {
                  if (turnPhase !== 'action') return;
                  onCellPress({ x, y });
                }}
                activeOpacity={hlType || isTargeted || isMoveRange ? 0.65 : 1}
              />
            );
          })}
        </View>
      ))}

      {/* ── Path visualization (above cells, below characters) ── */}
      {renderPath()}

      {/* ── Player character ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.characterAnchor,
          {
            left: playerCellX - CHAR_WIDTH / 2,
            top: playerCellY - CHAR_HEIGHT,
            transform: [{ scale: playerPulse }, { translateX: playerAttackOffset }],
          },
        ]}
      >
        {playerModelUrl ? (
          <CypherModel3D
            ref={playerWebViewRef}
            modelUrl={playerModelUrl}
            side="player"
            width={CHAR_WIDTH}
            height={CHAR_HEIGHT}
          />
        ) : playerImageUrl ? (
          <Image source={{ uri: playerImageUrl }} style={styles.characterImage} resizeMode="contain" />
        ) : (
          <View style={[styles.characterPlaceholder, { borderColor: playerColor + '88', backgroundColor: playerColor + '18' }]}>
            <Text style={[styles.characterInitial, { color: playerColor }]}>{playerInitial}</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Opponent character (scaleX:-1 only for PNG fallback) ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.characterAnchor,
          {
            left: opponentCellX - CHAR_WIDTH / 2,
            top: opponentCellY - CHAR_HEIGHT,
            transform: opponentModelUrl
              ? [{ scale: opponentPulse }, { translateX: opponentShake }]
              : [{ scaleX: -1 }, { scale: opponentPulse }, { translateX: opponentShake }],
          },
        ]}
      >
        {opponentModelUrl ? (
          <CypherModel3D
            ref={opponentWebViewRef}
            modelUrl={opponentModelUrl}
            side="opponent"
            width={CHAR_WIDTH}
            height={CHAR_HEIGHT}
          />
        ) : opponentImageUrl ? (
          <Image source={{ uri: opponentImageUrl }} style={styles.characterImage} resizeMode="contain" />
        ) : (
          <View style={[styles.characterPlaceholder, { borderColor: opponentColor + '88', backgroundColor: opponentColor + '18' }]}>
            <Text style={[styles.characterInitial, { color: opponentColor }]}>{opponentInitial}</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Attack line overlay ── */}
      {attackLine && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.attackLine,
            attackConnected === false && styles.attackLineMiss,
            {
              opacity: attackLineOpacity,
              left: attackLine.midX - attackLine.length / 2,
              top: attackLine.midY - 1,
              width: attackLine.length,
              transform: [{ rotate: `${attackLine.angle}deg` }],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    width: COLS * CELL,
    height: ROWS * CELL,
    position: 'relative',
    backgroundColor: '#030a14',
    borderWidth: 1,
    borderColor: '#0f1f35',
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL,
    height: CELL,
    borderWidth: 0.5,
    borderColor: '#0a1628',
  },
  cellMoveRange: {
    backgroundColor: 'rgba(0, 200, 200, 0.10)',
    borderColor: '#007777',
  },
  cellPath: {
    backgroundColor: 'rgba(0, 220, 220, 0.22)',
    borderColor: '#00aaaa',
  },
  cellMove: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: '#1d4ed8',
  },
  cellAttack: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: '#b91c1c',
  },
  cellTarget: {
    backgroundColor: 'rgba(234,179,8,0.28)',
    borderColor: '#ca8a04',
    borderWidth: 1.5,
  },
  characterAnchor: {
    position: 'absolute',
    width: CHAR_WIDTH,
    height: CHAR_HEIGHT,
  },
  characterImage: {
    width: CHAR_WIDTH,
    height: CHAR_HEIGHT,
  },
  characterPlaceholder: {
    width: CHAR_WIDTH,
    height: CHAR_HEIGHT,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterInitial: {
    fontSize: 22,
    fontWeight: '800',
  },
  attackLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#60a5fa',
    borderRadius: 1,
  },
  attackLineMiss: {
    backgroundColor: '#9ca3af',
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00FFFF',
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  pathDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 220, 220, 0.7)',
  },
  pathArrow: {
    color: 'rgba(0, 220, 220, 0.8)',
    fontSize: 7,
    position: 'absolute',
    top: -9,
    textAlign: 'center',
  },
});
