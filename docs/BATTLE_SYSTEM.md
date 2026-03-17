# Arch:Genesis — Battle System Reference

## Overview

Battles take place on a **13×7 grid** (Framework Arena). Each player controls one Cypher. Turns are resolved by the AI Framework Master, narrated by the AI Narrator.

---

## Grid Specification

| Property | Value |
|----------|-------|
| Columns | 13 (x: 1–13, left to right) |
| Rows | 7 (y: 1–7, top to bottom) |
| Cell size | 28px |
| Grid dimensions | 364px × 196px |
| Player start | `{x: 1, y: 4}` (left side, middle) |
| Opponent start | `{x: 13, y: 4}` (right side, middle) |

### Distance Calculation: Chebyshev

All range checks use **Chebyshev distance**: `max(|Δx|, |Δy|)`

This means diagonal movement counts as 1, same as orthogonal. A range of 2 covers a 5×5 square centered on the source.

---

## Stat → Grid Mapping

| Stat | Grid Role |
|------|-----------|
| `movement_speed` | How many cells a Cypher can reposition per turn |
| `attack_range` | Max Chebyshev distance for basic attacks |
| `melee_power` | Damage modifier when within attack_range |
| `defense_rating` | Reduces incoming damage, affects condition thresholds |
| `special_range` | Max Chebyshev distance for special abilities |
| `initiative` | Determines who commits their move first each turn |

---

## Move-Phase Selection (Client)

### Phase 1 — Select Move
- Player taps a move card from their 4 options
- Cells are highlighted based on move type:
  - **Basic attack** → orange cells within `attack_range` of player
  - **Special 1 / Special 2** → orange cells within `special_range` of player
  - **Defense / Passive** → blue cells within `movement_speed` of player (repositioning)

### Phase 2 — Select Target Cell
- Player taps any highlighted cell to lock in a target
- Execute button becomes active (neon blue)

### Phase 3 — Execute
- Player taps Execute
- Positions + target sent to Framework Master
- AI resolves turn, returns new positions, attack_connected flag
- Grid animates: attack line flash → position update
- Narration begins

---

## Turn Resolution (Edge Function: battle-framework-master)

### Inputs
```json
{
  "mode": "resolve_turn",
  "player_cypher": { ... },
  "opponent_cypher": { ... },
  "player_position": { "x": 1, "y": 4 },
  "opponent_position": { "x": 13, "y": 4 },
  "target_cell": { "x": 5, "y": 4 },
  "advantage_score": 0,
  "current_turn": 1,
  "player_selected_move": "...",
  "battle_phase": "early",
  "initiative_winner": "player",
  "move_history": []
}
```

### Outputs (additions to existing schema)
```json
{
  "player_new_position": { "x": 3, "y": 4 },
  "opponent_new_position": { "x": 11, "y": 4 },
  "attack_connected": true,
  "positional_advantage": "player"
}
```

---

## Grid AI Rules (Framework Master)

### Opponent Positioning Logic
- **Aggressive** cyphers: close distance aggressively, target within attack_range ASAP
- **Tactical** cyphers: maintain optimal range (attack_range - 1), never overcommit
- **Defensive** cyphers: hold position or retreat when pressured, maximize defense_rating advantage

### Positional Advantage
- If opponent is within player's attack_range but player is outside opponent's range: **player has positional advantage** (+1 to advantage_delta)
- If opponent is within player's melee_power range (≤2): **melee pressure** active

### Attack Connection Rules
- Basic attack connects if `distance(player_pos, target_cell) ≤ attack_range`
- Special connects if `distance(player_pos, target_cell) ≤ special_range`
- Defense/Passive moves always "connect" (they're self-targeting)
- Missed attacks: `attack_connected: false`, slight advantage penalty

---

## Narration Integration

The Narrator receives grid context to write spatially-aware prose:
- Knows when fighters are close (melee) vs ranged
- Describes movement across the grid as physical repositioning
- References distance as tension ("closing the gap", "maintaining distance", "lunging across the arena")

---

## Condition States

Derived from `new_advantage_score` (player perspective):

| Score | Player Condition | Opponent Condition |
|-------|-----------------|-------------------|
| ≤ -6 | Desperate | Stable |
| ≤ -4 | Critical | Stable |
| ≤ -2 | Pressured | Stable |
| -1 to +1 | Stable | Stable |
| ≥ +2 | Stable | Pressured |
| ≥ +4 | Stable | Critical |
| ≥ +6 | Stable | Desperate |

---

## Battle Structure

- **Max 7 turns**
- **Phases**: early (1–2), mid (3–4), late (5–7)
- **Advantage score**: integer –10 to +10 (player perspective)
- **Weakness finisher**: available at score ≥ 6, turn ≥ 5
- **Lucky Way Out**: active at score ≤ –4 (two escape options provided)

---

## Stat Colors (UI Reference)

| Stat | Color |
|------|-------|
| movement_speed | `#06b6d4` (cyan) |
| attack_range | `#f97316` (orange) |
| melee_power | `#ef4444` (red) |
| defense_rating | `#3b82f6` (blue) |
| special_range | `#a855f7` (purple) |
| initiative | `#eab308` (yellow) |
