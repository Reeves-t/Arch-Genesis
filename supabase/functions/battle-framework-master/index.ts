import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callClaude(system: string, userMessage: string, maxTokens = 1500): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function extractJSON(text: string): any {
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(stripped.slice(start, end + 1));
}

function clampPos(x: number, y: number): { x: number; y: number } {
  return { x: Math.max(1, Math.min(13, Math.round(x))), y: Math.max(1, Math.min(7, Math.round(y))) };
}

// ─── NPC GENERATION ───────────────────────────────────────────────────────────

const NPC_SYSTEM = `You are the Framework Master AI governing the Arch:Genesis universe. Design a complete, cohesive NPC opponent — think of them as a real fighter with a distinct combat identity, not a random assortment of stats. Return ONLY a raw JSON object, no markdown, no code blocks, no explanation.`;

const NPC_USER = `Design a unique NPC cypher opponent with a coherent combat identity.

DESIGN RULES:
- Name should feel like it belongs in a digital/cyber universe (examples: Tessera-7, Phantom-X, Nullvane, Grix, Oblivion-3, Serrath, Warden-0)
- Kit abilities must have SYNERGY — they should form a cohesive fighting system. A fast aggressive cypher might chain Burst into Cascade into Rupture. A heavy defensive one might use Fortress, Anchoring, and Counterdrive.
- Weakness must be THEMATICALLY CONNECTED to their strengths. A heavily armored defensive cypher is weak to relentless pressure. A fast aggressive cypher is weak to patience and precise timing.
- Battle profile (description) must read like a scouting report: what are their patterns, how do they open, what do they do when pressured, what's their signature moment

Return exactly this JSON:
{
  "name": "...",
  "originLog": "One evocative sentence about their origin in the Framework",
  "sizeClass": "One of: Compact, Standard, Heavy",
  "mobility": "One of: Agile, Balanced, Grounded",
  "combatStyle": "One of: Aggressive, Tactical, Defensive",
  "basicAttack": "1-3 word ability name",
  "special1": "1-3 word ability name that synergizes with basicAttack",
  "special2": "1-3 word ability name that completes the kit",
  "defense": "1-3 word ability name",
  "passive": "1-3 word ability name that triggers naturally from their fighting style",
  "weakness": "One of: Energy Vulnerable, Physical Vulnerable, Low Mobility, Fragile Structure",
  "description": "2-3 sentences: how they fight, their personality in combat, what makes them dangerous"
}`;

// ─── TURN RESOLUTION ──────────────────────────────────────────────────────────

const BATTLE_SYSTEM = `You are the Framework Master, the AI intelligence that governs all battles in the Arch:Genesis universe.

BATTLE RULES:
- Advantage score: integer -10 to +10 (player perspective, starts at 0)
- advantage_delta per turn: typically -3 to +3, rarely ±4 for dramatic moments
- new_advantage_score = clamp(old + delta, -10, 10)
- Battle is 7 turns maximum

CONDITION STATES (from new_advantage_score):
- Player: <= -6 → Desperate; <= -4 → Critical; <= -2 → Pressured; else → Stable
- Opponent: >= 6 → Desperate; >= 4 → Critical; >= 2 → Pressured; else → Stable

BATTLE PHASES: "early" turns 1-2, "mid" turns 3-4, "late" turns 5-7

SPECIAL MECHANICS:
- Player weakness_finisher_available: true when score >= 6 AND current_turn >= 5
- opponent_weakness_finisher_available: true when score <= -6 AND current_turn >= 5 — if this triggers, opponent LANDS it, set is_battle_over: true, winner: "opponent"
- lucky_way_out_active: true when score <= -4; provide lucky_way_out_path: ["move1 desc", "move2 desc"]
- turn_winner: "player" if delta > 0, "opponent" if delta < 0, "draw" if 0

GRID COMBAT RULES (13×7 arena, Chebyshev distance):
- Player starts at {x:1,y:4}, Opponent starts at {x:13,y:4}
- Chebyshev distance = max(|Δx|, |Δy|)
- basic attack connects if Chebyshev(player_pos, target_cell) <= attack_range stat (default 4)
- special attack connects if Chebyshev(player_pos, target_cell) <= special_range stat (default 4)
- defense/passive moves always connect (self-targeting repositioning)
- Missed attacks reduce advantage_delta by 1 extra
- POSITIONAL ADVANTAGE: if player is within attack_range of opponent but opponent is NOT within their range of player: +1 to advantage_delta
- MELEE PRESSURE: if Chebyshev(player_pos, opponent_pos) <= 2, melee_power stat amplifies delta by 0.5 (round to int)

OPPONENT AI POSITIONING:
- Aggressive combatStyle: always tries to close distance, new_opponent_position moves 2-3 cells toward player
- Tactical combatStyle: maintains optimal range (attack_range - 1 away from player), repositions to flank
- Defensive combatStyle: retreats when pressured (score >= 4 for player), holds position otherwise
- Opponent never moves to same cell as player
- Clamp all positions: x in [1,13], y in [1,7]

PLAYER POSITIONING:
- If player selected a movement/defense move: player moves toward target_cell (up to movement_speed stat, default 3)
- If player selected an attack: player may step 1 cell toward target_cell to press attack
- Never move player to opponent's cell

OPPONENT AI — plays to win with memory of the entire fight:
- Read the FULL move_history. Detect player patterns (same ability used 2+ times). Counter them specifically.
- Build pressure systematically. Early: probe. Mid: exploit patterns. Late: decisive swings.
- When opponent is Desperate: high-risk/high-reward moves
- Use opponent's passive when conditions logically trigger it

MOVE GENERATION — player's next 4 options (follow ALL rules):
1. LAST TURN RESPONSE: Win → 2 aggressive options. Loss → 1 recovery + 1 counter. Draw → pivots.
2. OPPONENT'S LAST MOVE REACTION: Reference what the opponent did and how to respond specifically
3. PATTERN PUNISHMENT: If player used same ability 2+ turns, one option MUST break the pattern
4. KIT GROUNDING: Every option uses actual ability names embedded organically in text
5. PASSIVE TRIGGER: If battle state triggers passive, one option activates it

Context fields required every turn:
- last_turn_context: 1 sentence tactical situation informing move options
- opponent_move_reasoning: 1 sentence explaining why opponent chose this specific move

MOVEMENT PATH SYSTEM:
- player_move_path is an array of cells the player traced as their route (start to destination)
- player_final_position is the last cell in their path (starting point for combat this turn)
- Assess the path for positional advantage:
  - Flanking path (ends past opponent's starting x from player's perspective): +1 advantage bonus
  - Straight charge: predictable, note in opponent_move_reasoning that opponent read it
  - Evasive/curved path: harder to predict, slight defensive bonus
- Opponent AI traces a path each turn based on combat style:
  - Aggressive: straight line toward player, closes distance maximally
  - Tactical: flanking arc, moves to perpendicular angle relative to player
  - Defensive: retreats when player closes (score >= 4), holds position otherwise
- Generate opponent_move_path as array of grid cells for the opponent's movement this turn
- Opponent path length = min(movement_speed, distance to target)
- EVASION MISS: if player moved away from old position and opponent targeted old position, set attack_missed_reason: "evaded"

Return ONLY raw JSON — no markdown, no code blocks, no explanation.`;

function buildTurnUserMessage(body: any): string {
  const {
    player_cypher: p,
    opponent_cypher: o,
    player_position,
    opponent_position,
    target_cell,
    advantage_score,
    current_turn,
    move_history,
    player_selected_move,
    battle_phase,
    initiative_winner,
  } = body;

  const pPos = body.player_final_position ?? player_position ?? { x: 1, y: 4 };
  const oPos = opponent_position ?? { x: 13, y: 4 };
  const tCell = target_cell ?? { x: 7, y: 4 };
  const playerPath = body.player_move_path ?? [];
  const pathLength = playerPath.length;
  const chebyshev = (a: any, b: any) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const dist = chebyshev(pPos, oPos);
  const targetDist = chebyshev(pPos, tCell);

  const historyText =
    move_history.length === 0
      ? 'None — this is the opening turn.'
      : move_history
          .slice(-5)
          .map(
            (m: any) =>
              `Turn ${m.turn_number}: Player → "${m.player_move}" | Opponent → "${m.opponent_move}" | Delta: ${m.advantage_delta > 0 ? '+' : ''}${m.advantage_delta} | Winner: ${m.turn_winner ?? 'unknown'}`
          )
          .join('\n');

  let patternNote = '';
  if (move_history.length >= 2) {
    const lastTwo = move_history.slice(-2).map((m: any) => m.player_move.toLowerCase());
    const kitNames = [p.kit.basicAttack, p.kit.special1, p.kit.special2, p.kit.defense, p.kit.passive].map(
      (n: string) => n.toLowerCase()
    );
    for (const abilityName of kitNames) {
      if (lastTwo.every((move: string) => move.includes(abilityName))) {
        patternNote = `PATTERN DETECTED: Player has used "${abilityName}" 2 turns in a row — one move option MUST break this pattern.`;
        break;
      }
    }
  }

  const lastTurn = move_history.length > 0 ? move_history[move_history.length - 1] : null;
  const lastTurnContext = lastTurn
    ? `Last turn: Player used "${lastTurn.player_move}" | Opponent used "${lastTurn.opponent_move}" | Result: ${lastTurn.turn_winner ?? 'unknown'}`
    : 'No previous turns.';

  const pStats = p.stats ?? {};
  const oStats = o.stats ?? {};

  return `Resolve this battle turn.

PLAYER CYPHER — ${p.name}:
Size: ${p.sizeClass} | Mobility: ${p.mobility} | Combat Style: ${p.combatStyle}
Stats: ATK_RANGE=${pStats.attack_range ?? 4} | SPL_RANGE=${pStats.special_range ?? 4} | MELEE=${pStats.melee_power ?? 5} | DEF=${pStats.defense_rating ?? 5} | MOVE=${pStats.movement_speed ?? 3} | INIT=${pStats.initiative ?? 5}
Kit — Basic: ${p.kit.basicAttack} | Special1: ${p.kit.special1} | Special2: ${p.kit.special2} | Defense: ${p.kit.defense} | Passive: ${p.kit.passive}
Weakness: ${p.kit.weakness}
Battle Profile: ${p.description}

OPPONENT CYPHER — ${o.name}:
Size: ${o.sizeClass} | Mobility: ${o.mobility} | Combat Style: ${o.combatStyle}
Stats: ATK_RANGE=${oStats.attack_range ?? 4} | SPL_RANGE=${oStats.special_range ?? 4} | MELEE=${oStats.melee_power ?? 5} | DEF=${oStats.defense_rating ?? 5} | MOVE=${oStats.movement_speed ?? 3} | INIT=${oStats.initiative ?? 5}
Kit — Basic: ${o.kit.basicAttack} | Special1: ${o.kit.special1} | Special2: ${o.kit.special2} | Defense: ${o.kit.defense} | Passive: ${o.kit.passive}
Weakness: ${o.kit.weakness}
Battle Profile: ${o.description}

GRID STATE:
Player final position this turn: (${pPos.x}, ${pPos.y}) | Opponent position: (${oPos.x}, ${oPos.y})
Distance between fighters: ${dist} cells (Chebyshev)
Player target cell: (${tCell.x}, ${tCell.y}) — distance to target: ${targetDist} cells
Player attack_range: ${pStats.attack_range ?? 4} | Opponent attack_range: ${oStats.attack_range ?? 4}
Attack would connect: ${targetDist <= (pStats.attack_range ?? 4) ? 'YES' : 'NO — MISS'}
Player movement path this turn: ${pathLength <= 1 ? 'Held position' : `${pathLength - 1} steps — ${JSON.stringify(playerPath)}`}

CURRENT STATE:
Advantage Score: ${advantage_score} (player perspective)
Turn: ${current_turn}/7 | Phase: ${battle_phase}
Initiative this turn: ${initiative_winner} moved first
Player selected move: "${player_selected_move}"

IMMEDIATE CONTEXT:
${lastTurnContext}
${patternNote || 'No pattern detected yet.'}

FULL MOVE HISTORY:
${historyText}

Return this exact JSON (include grid positions):
{
  "opponent_move": "ability name used",
  "opponent_move_description": "one sentence describing the opponent's action and intent",
  "advantage_delta": <integer -4 to +4>,
  "new_advantage_score": <integer -10 to +10>,
  "player_condition": "Stable" | "Pressured" | "Critical" | "Desperate",
  "opponent_condition": "Stable" | "Pressured" | "Critical" | "Desperate",
  "turn_winner": "player" | "opponent" | "draw",
  "attack_connected": true | false,
  "player_new_position": {"x": <1-13>, "y": <1-7>},
  "opponent_new_position": {"x": <1-13>, "y": <1-7>},
  "positional_advantage": "player" | "opponent" | "none",
  "weakness_finisher_available": true | false,
  "opponent_weakness_finisher_available": true | false,
  "lucky_way_out_active": true | false,
  "lucky_way_out_path": ["move desc 1", "move desc 2"] or null,
  "next_player_options": [
    {"id": "opt_1", "action_description": "organic description embedding the ability name", "is_weakness_finisher": false, "is_lucky_way_out_step": false},
    {"id": "opt_2", "action_description": "...", "is_weakness_finisher": false, "is_lucky_way_out_step": false},
    {"id": "opt_3", "action_description": "...", "is_weakness_finisher": false, "is_lucky_way_out_step": false},
    {"id": "opt_4", "action_description": "...", "is_weakness_finisher": false, "is_lucky_way_out_step": false}
  ],
  "battle_phase": "early" | "mid" | "late",
  "is_battle_over": true | false,
  "winner": "player" | "opponent" | null,
  "last_turn_context": "one sentence tactical situation",
  "opponent_move_reasoning": "one sentence explaining opponent's choice",
  "opponent_move_path": [{"x": 13, "y": 4}, {"x": 11, "y": 4}],
  "attack_missed_reason": "evaded" | "out_of_range" | null
}`;
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    const { mode } = body;

    if (mode === 'generate_npc') {
      const raw = await callClaude(NPC_SYSTEM, NPC_USER, 900);
      const npc = extractJSON(raw);
      return new Response(JSON.stringify(npc), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'resolve_turn') {
      const userMsg = buildTurnUserMessage(body);
      const raw = await callClaude(BATTLE_SYSTEM, userMsg, 2000);
      const result = extractJSON(raw);

      // Clamp grid positions to valid range
      if (result.player_new_position) {
        result.player_new_position = clampPos(result.player_new_position.x, result.player_new_position.y);
      }
      if (result.opponent_new_position) {
        result.opponent_new_position = clampPos(result.opponent_new_position.x, result.opponent_new_position.y);
      }
      if (result.opponent_move_path && Array.isArray(result.opponent_move_path)) {
        result.opponent_move_path = result.opponent_move_path.map((p: any) => clampPos(p.x, p.y));
      }

      return new Response(JSON.stringify(result), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid mode.' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('battle-framework-master error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
