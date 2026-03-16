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

// ─── NPC GENERATION ───────────────────────────────────────────────────────────

const NPC_SYSTEM = `You are the Framework Master AI governing the Arch:Genesis universe. Design a complete, cohesive NPC opponent — think of them as a real fighter with a distinct combat identity, not a random assortment of stats. Return ONLY a raw JSON object, no markdown, no code blocks, no explanation.`;

const NPC_USER = `Design a unique NPC cypher opponent with a coherent combat identity.

DESIGN RULES:
- Name should feel like it belongs in a digital/cyber universe (examples: Tessera-7, Phantom-X, Nullvane, Grix, Oblivion-3, Serrath, Warden-0)
- Kit abilities must have SYNERGY — they should form a cohesive fighting system, not random moves. A fast aggressive cypher might chain Burst into Cascade into Rupture. A heavy defensive one might use Fortress, Anchoring, and Counterdrive. The abilities should feel designed together.
- Weakness must be THEMATICALLY CONNECTED to their strengths. A heavily armored defensive cypher is weak to relentless pressure that never lets it anchor. A fast aggressive cypher is weak to patience and precise timing. The weakness is the price paid for the strength.
- Visual style should be specific and evocative — not just "Geometric" but what makes this particular cypher visually distinct
- Battle profile (description) must read like a scouting report written by someone who has fought them: what are their patterns, how do they open, what do they do when pressured, what's their signature moment

Return exactly this JSON:
{
  "name": "...",
  "visualStyle": "One of: Crystalline, Organic, Geometric, Ethereal (pick the one that fits the concept)",
  "originLog": "One evocative sentence about their origin in the Framework",
  "sizeClass": "One of: Compact, Standard, Heavy",
  "mobility": "One of: Agile, Balanced, Grounded",
  "material": "One of: Light, Adaptive, Reinforced",
  "combatStyle": "One of: Aggressive, Tactical, Defensive",
  "basicAttack": "1-3 word ability name that fits the concept",
  "special1": "1-3 word ability name that synergizes with basicAttack",
  "special2": "1-3 word ability name that completes the kit",
  "defense": "1-3 word ability name",
  "passive": "1-3 word ability name that triggers naturally from their fighting style",
  "weakness": "One of: Energy Vulnerable, Physical Vulnerable, Low Mobility, Fragile Structure — choose the one thematically connected to their strengths",
  "description": "2-3 sentences: how they fight, their personality in combat, what makes them dangerous — written as a scouting report"
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

OPPONENT AI — plays to win with memory of the entire fight:
- Read the FULL move_history. Detect player patterns (same ability used 2+ times). Counter them specifically.
- Build pressure systematically — don't let advantages slip
- Early: probe and establish style. Mid: escalate and exploit patterns. Late: decisive, high-stakes moves
- When opponent is Desperate: abandon conservative play, make high-risk/high-reward swings
- Use the opponent's own passive when conditions logically trigger it
- The opponent should feel like it has been IN this fight, adapting turn by turn

MOVE GENERATION — player's next 4 options (follow ALL rules):

1. LAST TURN RESPONSE:
   - Player won last turn → 2 options press the opening, escalate
   - Player lost last turn → 1 recovery/defensive option, 1 counter
   - Draw → options that break the stalemate, tactical pivots
   - Turn 1 → opening options that establish the player's fighting style

2. OPPONENT'S LAST MOVE REACTION:
   - Opponent used defensive ability → include a move that overwhelms or bypasses that defense
   - Opponent used heavy attack → include a counter-strike or evasion-then-punish option
   - Opponent used special ability → one option specifically responds to or exploits that opening

3. PATTERN PUNISHMENT:
   - Scan move_history: if player used the same ability keyword 2+ turns in a row, one option MUST be framed as breaking that pattern — "they are reading you — shift to [OtherAbility] and catch them off-guard"

4. KIT GROUNDING — every option uses the player's ACTUAL abilities:
   - Ability names (basicAttack, special1, special2, defense, passive) must be embedded ORGANICALLY in the action description
   - Write: "channel your Overload into the exact fracture [OpponentName] just exposed" NOT "use your special attack"
   - The ability name appears inside the description naturally, not as a label above it

5. PASSIVE TRIGGER:
   - If current battle state logically triggers the passive (momentum shift, opponent pressured, player just absorbed a hit), one option must activate the passive framed as a tactical decision: "this moment triggers [PassiveName] — exploit it to..."

Output these two context fields in every turn resolution:
- last_turn_context: 1 sentence about what tactical situation is informing the move options this turn
- opponent_move_reasoning: 1 sentence explaining why the opponent chose its specific move this turn

Return ONLY raw JSON — no markdown, no code blocks, no explanation.`;

function buildTurnUserMessage(body: any): string {
  const {
    player_cypher: p,
    opponent_cypher: o,
    advantage_score,
    current_turn,
    move_history,
    player_selected_move,
    battle_phase,
    initiative_winner,
  } = body;

  // Build detailed history with pattern analysis context
  const historyText = move_history.length === 0
    ? 'None — this is the opening turn.'
    : move_history.slice(-5).map((m: any) =>
        `Turn ${m.turn_number}: Player → "${m.player_move}" | Opponent → "${m.opponent_move}" | Delta: ${m.advantage_delta > 0 ? '+' : ''}${m.advantage_delta} | Winner: ${m.turn_winner ?? 'unknown'}`
      ).join('\n');

  // Detect player pattern for explicit context
  let patternNote = '';
  if (move_history.length >= 2) {
    const lastTwo = move_history.slice(-2).map((m: any) => m.player_move.toLowerCase());
    const kitNames = [p.kit.basicAttack, p.kit.special1, p.kit.special2, p.kit.defense, p.kit.passive]
      .map((n: string) => n.toLowerCase());
    for (const abilityName of kitNames) {
      if (lastTwo.every((move: string) => move.includes(abilityName))) {
        patternNote = `PATTERN DETECTED: Player has used "${p.kit[Object.entries(p.kit).find(([, v]) => (v as string).toLowerCase() === abilityName)?.[0] ?? ''] ?? abilityName}" in the last 2 turns — one move option MUST break this pattern.`;
        break;
      }
    }
  }

  const lastTurn = move_history.length > 0 ? move_history[move_history.length - 1] : null;
  const lastTurnContext = lastTurn
    ? `Last turn: Player used "${lastTurn.player_move}" | Opponent used "${lastTurn.opponent_move}" | Result: ${lastTurn.turn_winner ?? 'unknown'}`
    : 'No previous turns.';

  return `Resolve this battle turn.

PLAYER CYPHER — ${p.name}:
Visual Style: ${p.visualStyle} | Size: ${p.sizeClass} | Mobility: ${p.mobility} | Material: ${p.material} | Combat Style: ${p.combatStyle}
Kit — Basic: ${p.kit.basicAttack} | Special1: ${p.kit.special1} | Special2: ${p.kit.special2} | Defense: ${p.kit.defense} | Passive: ${p.kit.passive}
Weakness: ${p.kit.weakness}
Battle Profile: ${p.description}

OPPONENT CYPHER — ${o.name}:
Visual Style: ${o.visualStyle} | Size: ${o.sizeClass} | Mobility: ${o.mobility} | Material: ${o.material} | Combat Style: ${o.combatStyle}
Kit — Basic: ${o.kit.basicAttack} | Special1: ${o.kit.special1} | Special2: ${o.kit.special2} | Defense: ${o.kit.defense} | Passive: ${o.kit.passive}
Weakness: ${o.kit.weakness}
Battle Profile: ${o.description}

CURRENT STATE:
Advantage Score: ${advantage_score} (player perspective)
Turn: ${current_turn}/7 | Phase: ${battle_phase}
Initiative this turn: ${initiative_winner} moved first
Player selected move: "${player_selected_move}"

IMMEDIATE CONTEXT:
${lastTurnContext}
${patternNote ? patternNote : 'No pattern detected yet.'}

FULL MOVE HISTORY:
${historyText}

Return this exact JSON:
{
  "opponent_move": "ability name used",
  "opponent_move_description": "one sentence describing the opponent's action and intent",
  "advantage_delta": <integer -4 to +4>,
  "new_advantage_score": <integer -10 to +10>,
  "player_condition": "Stable" | "Pressured" | "Critical" | "Desperate",
  "opponent_condition": "Stable" | "Pressured" | "Critical" | "Desperate",
  "turn_winner": "player" | "opponent" | "draw",
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
  "last_turn_context": "one sentence tactical situation informing the move options",
  "opponent_move_reasoning": "one sentence explaining why opponent chose this specific move"
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
      const raw = await callClaude(BATTLE_SYSTEM, userMsg, 1800);
      const result = extractJSON(raw);
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
