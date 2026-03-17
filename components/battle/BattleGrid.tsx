import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';

const COLS = 13;
const ROWS = 7;
const CELL = 28;

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
}: BattleGridProps) {
  const playerPulse = useRef(new Animated.Value(1)).current;
  const opponentPulse = useRef(new Animated.Value(1)).current;
  const attackLineOpacity = useRef(new Animated.Value(0)).current;

  // Idle pulse loops
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(playerPulse, { toValue: 1.15, duration: 1600, useNativeDriver: true }),
        Animated.timing(playerPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opponentPulse, { toValue: 1.15, duration: 1900, useNativeDriver: true }),
          Animated.timing(opponentPulse, { toValue: 1, duration: 1900, useNativeDriver: true }),
        ])
      ).start();
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // Attack line flash when lastAttack changes
  useEffect(() => {
    if (!lastAttackFrom || !lastAttackTo) return;
    attackLineOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(attackLineOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(attackLineOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [lastAttackFrom, lastAttackTo]);

  // Compute attack line geometry (centered rotation in absolute overlay)
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

  const highlightMap = new Map(highlightedCells.map((h) => [`${h.x},${h.y}`, h.type]));

  return (
    <View style={styles.gridContainer}>
      {Array.from({ length: ROWS }, (_, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {Array.from({ length: COLS }, (_, colIdx) => {
            const x = colIdx + 1;
            const y = rowIdx + 1;
            const hlType = highlightMap.get(`${x},${y}`);
            const isTargeted = targetCell?.x === x && targetCell?.y === y;
            const hasPlayer = playerPos.x === x && playerPos.y === y;
            const hasOpponent = opponentPos.x === x && opponentPos.y === y;

            return (
              <TouchableOpacity
                key={colIdx}
                style={[
                  styles.cell,
                  hlType === 'move' && styles.cellMove,
                  hlType === 'attack' && styles.cellAttack,
                  isTargeted && styles.cellTarget,
                ]}
                onPress={() => onCellPress({ x, y })}
                activeOpacity={hlType || isTargeted ? 0.65 : 1}
              >
                {hasPlayer && (
                  <Animated.View
                    style={[
                      styles.marker,
                      { backgroundColor: playerColor, transform: [{ scale: playerPulse }] },
                    ]}
                  />
                )}
                {hasOpponent && (
                  <Animated.View
                    style={[
                      styles.marker,
                      { backgroundColor: opponentColor, transform: [{ scale: opponentPulse }] },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Attack line overlay */}
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
    justifyContent: 'center',
    alignItems: 'center',
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
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
});
