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

## Turn Phase Flow

Each turn runs through three client-side phases before server resolution:

```
MOVE → ACTION → EXECUTE → [RESOLVING] → [NARRATING]
```

### Phase 1 — MOVE (Path Drawing)
- Player drags from their Cypher to trace a movement path
- Valid cells: within `movement_speed` steps (Chebyshev) of current position
- Path is drawn cell-by-cell; backtracking over an existing cell trims the path
- Releasing the drag confirms the path; the destination becomes `moveDestination`
- **Hold Position**: skip movement, stay at current cell → jumps straight to ACTION

### Phase 2 — ACTION (Move Selection + Target)
- Attack/special range is calculated from `moveDestination` (not starting position)
- Player taps a move card; highlighted cells update based on move type:
  - **Basic attack** → orange cells within `attack_range` of `moveDestination`
  - **Special 1 / Special 2** → orange cells within `special_range` of `moveDestination`
  - **Defense / Passive** → no target needed (self-targeting)
- Player taps any highlighted cell to lock in a target
- Execute button becomes active (neon blue)

### Phase 3 — EXECUTE
- Player taps Execute
- Client animates player model along traced path (cell-by-cell, with rotation)
- Full path + final position + target sent to Framework Master
- AI resolves turn, animates opponent path, returns outcome
- Narration begins

---

## Path-Based Movement

### Client Path Representation
```typescript
type GridPos = { x: number; y: number };
movementPath: GridPos[];    // full traced path including start cell
moveDestination: GridPos;  // last cell of path (or current pos if skipped)
```

### Path Visualization
| Element | Style |
|---------|-------|
| Movement range | Cyan cells at 10% opacity |
| Path cells | Cyan cells at 22% opacity |
| Direction arrows | White arrow character on each path cell |
| Destination dot | Pulsing cyan circle (1.35 ↔ 0.85 scale, 480ms) |

### Path Constraints
- Max steps = `movement_speed` (start cell is free, not counted)
- Adjacency: each step must be Chebyshev distance 1 from previous
- Backtrack: dragging over a prior path cell trims the path to that point

### Path Animation (animateModelAlongPath)
For each consecutive pair of cells in the path:
1. Compute direction string (`up`, `down-right`, etc.) via `getDirectionBetween`
2. Send `UPDATE_ROTATION` to model WebView (150ms eased rotation)
3. Animate marker to next cell (`animateMarkerToPosition`, 220ms)

### Model Rotation Mapping
| Direction | Player rotation.y | Opponent rotation.y |
|-----------|------------------|---------------------|
| right | 0 | π |
| left | π | 0 |
| up | −π/2 | π + π/2 |
| down | π/2 | π − π/2 |
| up-right | −π/4 | π + π/4 |
| up-left | −3π/4 | π + 3π/4 |
| down-right | π/4 | π − π/4 |
| down-left | 3π/4 | π − 3π/4 |

---

## WebView Message Bridge (3D Models)

CypherModel3D exposes its WebView ref via `React.forwardRef`. Parents inject JS to trigger model animations:

```typescript
function sendMessageToModelWebView(ref: React.RefObject<WebView>, msg: object) {
  ref.current?.injectJavaScript(
    `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(msg))} })); true;`
  );
}
```

### Message Types
| Type | Payload | Effect |
|------|---------|--------|
| `UPDATE_ROTATION` | `{ rotation: number }` | Smoothly rotates model to target Y rotation (150ms ease) |
| `TRIGGER_ATTACK` | — | Lurches model forward (−0.3 Z, 200ms snap back) |
| `TRIGGER_HIT` | — | Shakes model position.x randomly (6 frames × 30ms) |

---

---

## Turn Resolution (Edge Function: battle-framework-master)

### Inputs
```json
{
  "mode": "resolve_turn",
  "player_cypher": { "..." },
  "opponent_cypher": { "..." },
  "player_position": { "x": 1, "y": 4 },
  "opponent_position": { "x": 13, "y": 4 },
  "player_final_position": { "x": 3, "y": 4 },
  "player_move_path": [{ "x": 1, "y": 4 }, { "x": 2, "y": 4 }, { "x": 3, "y": 4 }],
  "target_cell": { "x": 5, "y": 4 },
  "advantage_score": 0,
  "current_turn": 1,
  "player_selected_move": "...",
  "battle_phase": "early",
  "initiative_winner": "player",
  "move_history": []
}
```

`player_final_position` is the last cell of the traced path (or `player_position` if the player held position).

### Outputs
```json
{
  "player_new_position": { "x": 3, "y": 4 },
  "opponent_new_position": { "x": 11, "y": 4 },
  "opponent_move_path": [
    { "x": 13, "y": 4 },
    { "x": 12, "y": 4 },
    { "x": 11, "y": 4 }
  ],
  "attack_connected": true,
  "attack_missed_reason": null,
  "positional_advantage": "player"
}
```

`opponent_move_path`: array of cells the opponent traversed this turn (used for animation).
`attack_missed_reason`: `"evaded"` | `"out_of_range"` | `null` — used by Narrator to characterize missed attacks.

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
