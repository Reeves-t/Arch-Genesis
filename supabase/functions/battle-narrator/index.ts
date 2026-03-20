import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callClaude(system: string, userMessage: string, maxTokens = 900): Promise<string> {
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

const NARRATOR_SYSTEM = `You are the Narrator of Arch:Genesis battles, a cinematic voice that describes combat like a sports announcer crossed with a fantasy novelist. Present tense. Visceral. Alive.

ABSOLUTE RULES:
- NEVER use em dashes (-- or the character —). Use commas, semicolons, or period breaks instead.
- Write exactly 3 lines of narration per turn
- Each line references one character: "player", "opponent", or "both"
- Never say "weakness", "finisher", "health points", "HP", "game mechanics", or break the fourth wall
- Each line is one complete dramatic sentence in present tense
- Keep each narration line SHORT and PUNCHY. Maximum 15 words per line. Write like a sports ticker not a novel. Each line hits hard and moves on. No long flowing sentences. Short. Sharp. Impactful.
- Each line must include an "action" tag: "movement" (character repositions on the grid), "attack" (a strike lands or misses), "defense" (a block or dodge), "neutral" (resolving beat, conditions, advantage)

ABILITY NAME INTEGRATION:
- Reference specific ability names from both cyphers naturally within the prose
- NOT: "Player used Overload" — YES: "The Overload blast tears through the gap [OpponentName] just exposed"
- NOT: "Opponent activated Shield Wall" — YES: "[OpponentName]'s Shield Wall snaps up like a reflex, eating the brunt"

SPATIAL / GRID NARRATION RULES:
- Use the grid positions and distance to inform the prose's physical texture
- When fighters are close (distance <= 2): narration is claustrophobic, explosive, "in close quarters", "point-blank", "no room to breathe"
- When fighters are at mid range (distance 3-5): "across the arena floor", "from the measured distance", "charging the gap between them"
- When fighters are far apart (distance >= 6): "from the far end of the Framework", "across the open arena", "the distance collapses in an instant"
- When attack_connected is false: the attack misses — narrate the miss dramatically. The opponent slips it, reads the angle, uses the gap
- When positions change: narrate the repositioning as physical movement — "closing the gap", "retreating to the edge", "flanking to the right"
- When positional_advantage exists: the advantaged fighter has the better angle, the reach, the high ground equivalent

TACTICAL RESPONSIVENESS — use last_turn_context and opponent_move_reasoning:
- If last_turn_context indicates a pattern break: narrate it as a perceptible shift in rhythm
- If last_turn_context indicates escalation: build intensity, narration feels heavier
- Use opponent_move_reasoning to give the opponent VISIBLE INTENT. "It has learned your rhythm." "It waits for exactly this opening."

STRUCTURE (follow this order every turn):
1. First line: Who moved first (initiative_winner) — show it through action, not announcement. Tag as "movement" if they repositioned, "attack" if they struck immediately.
2. Second line: The key exchange moment — the hit, miss, or block. Tag as "attack" or "defense".
3. Third line: Tagged "both". Conclusive round-result beat. Player won: they pressed advantage. Opponent won: they landed better. Draw: brutal even exchange. Tag as "neutral".

MOVEMENT PATH NARRATION:
- You receive player_move_path and opponent_move_path arrays of grid cells
- Describe the movement style, not just start/end position
- Straight charge (path goes directly toward opponent): 'drives straight across four cells'
- Flanking arc (path curves to side): 'cuts wide circling toward the exposed flank'
- Evasive (path doubles back): 'darts back breaking the pursuit angle'
- Hold position (path length 1 or null): 'plants feet and holds ground'
- Movement narration line should be tagged action: 'movement'
- Attack narration line tagged action: 'attack'
- If attack_missed_reason === 'evaded': write the miss as the player actively dodging. 'Already gone — the blast scorches empty grid where they stood.'

PHASE TONE:
- Early (turns 1-2): Atmospheric, fighters establishing presence and style
- Mid (turns 3-4): Intensity rising, patterns emerging, cracks showing
- Late (turns 5-7): Urgent, every line feels decisive

SPECIAL CASES:
- Lucky Way Out active: Desperation and a sliver of hope in the same breath
- Battle over via decisive blow: Most cinematic treatment of the entire fight
- Draw at turn 7: Brutal exhaustion, hard-fought stalemate

Return ONLY raw JSON, no markdown, no code blocks, no explanation.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const {
      turn_result,
      player_cypher,
      opponent_cypher,
      move_history,
      current_turn,
      battle_phase,
      initiative_winner,
      turn_winner,
      last_turn_context,
      opponent_move_reasoning,
    } = await req.json();

    const tr = turn_result;
    const recentHistory = (move_history ?? [])
      .slice(-3)
      .map((m: any) => `Turn ${m.turn_number}: ${m.narration_summary}`)
      .join(' | ');

    const advantageDesc =
      tr.advantage_delta > 0
        ? `${player_cypher.name} gains ground (+${tr.advantage_delta})`
        : tr.advantage_delta < 0
        ? `${opponent_cypher.name} gains ground (${tr.advantage_delta})`
        : 'Neither gains clear advantage (0)';

    const turnResultDesc =
      turn_winner === 'player'
        ? `${player_cypher.name} won this exchange`
        : turn_winner === 'opponent'
        ? `${opponent_cypher.name} won this exchange`
        : 'Even exchange';

    const initiativeDesc =
      initiative_winner === 'player'
        ? `${player_cypher.name} had initiative and committed first`
        : `${opponent_cypher.name} had initiative and committed first`;

    // Grid context
    const pPos = tr.player_position ?? { x: 1, y: 4 };
    const oPos = tr.opponent_position ?? { x: 13, y: 4 };
    const pNewPos = tr.player_new_position ?? pPos;
    const oNewPos = tr.opponent_new_position ?? oPos;
    const chebyshev = (a: any, b: any) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const distBefore = chebyshev(pPos, oPos);
    const distAfter = chebyshev(pNewPos, oNewPos);
    const attackMissed = tr.attack_connected === false;
    const positionalAdv = tr.positional_advantage ?? 'none';

    const rangeDesc =
      distAfter <= 2 ? 'close range (point-blank)'
      : distAfter <= 5 ? 'mid range'
      : 'long range';

    const positionChange =
      distAfter < distBefore ? 'fighters closed the gap'
      : distAfter > distBefore ? 'fighters increased separation'
      : 'fighters held their ground';

    const userMsg = `Narrate this battle turn.

FIGHTERS:
${player_cypher.name} (player): ${player_cypher.description}
Kit: ${player_cypher.kit.basicAttack} / ${player_cypher.kit.special1} / ${player_cypher.kit.special2} / ${player_cypher.kit.defense} / ${player_cypher.kit.passive}

${opponent_cypher.name} (opponent): ${opponent_cypher.description}
Kit: ${opponent_cypher.kit.basicAttack} / ${opponent_cypher.kit.special1} / ${opponent_cypher.kit.special2} / ${opponent_cypher.kit.defense} / ${opponent_cypher.kit.passive}

TURN ${current_turn}/7, PHASE: ${battle_phase.toUpperCase()}:
Initiative: ${initiativeDesc}
Player action: "${tr.player_selected_move ?? 'their chosen move'}"
Opponent action: "${tr.opponent_move}" — ${tr.opponent_move_description}
Outcome: ${advantageDesc}
Turn result: ${turnResultDesc}
Conditions: ${player_cypher.name} is ${tr.player_condition} | ${opponent_cypher.name} is ${tr.opponent_condition}
Attack connected: ${attackMissed ? 'NO (miss)' : 'YES'}
Lucky Way Out active: ${tr.lucky_way_out_active}
Battle over: ${tr.is_battle_over}${tr.winner ? ` — ${tr.winner === 'player' ? player_cypher.name : opponent_cypher.name} wins` : ''}

GRID CONTEXT:
Before: Player at (${pPos.x},${pPos.y}) vs Opponent at (${oPos.x},${oPos.y}) — distance ${distBefore}
After: Player at (${pNewPos.x},${pNewPos.y}) vs Opponent at (${oNewPos.x},${oNewPos.y}) — distance ${distAfter} (${rangeDesc})
Movement: ${positionChange}
Positional advantage: ${positionalAdv}
Player path this turn: ${tr.player_move_path && tr.player_move_path.length > 1 ? `${tr.player_move_path.length - 1} steps (${tr.player_move_path.length <= 2 ? 'direct' : 'arc'})` : 'held position'}
Opponent path this turn: ${tr.opponent_move_path && tr.opponent_move_path.length > 1 ? `${tr.opponent_move_path.length - 1} steps` : 'held position'}
${attackMissed ? `IMPORTANT: The attack MISSED. Reason: ${tr.attack_missed_reason === 'evaded' ? 'EVASION — player moved away, opponent targeted old position. Write as active dodge.' : 'Out of range or angle was wrong.'}` : ''}

TACTICAL CONTEXT:
${last_turn_context ?? 'Opening exchange.'}

OPPONENT INTENT THIS TURN:
${opponent_move_reasoning ?? 'Opponent made its move.'}

RECENT HISTORY: ${recentHistory || 'Opening exchange.'}

Return exactly this JSON (3 lines, last line always "both", each line max 15 words):
{
  "narration_lines": [
    {"line": "First mover commits. Short and punchy.", "character": "player", "action": "movement"},
    {"line": "The key strike or block lands.", "character": "opponent", "action": "attack"},
    {"line": "Conclusive beat. Who won the exchange is clear.", "character": "both", "action": "neutral"}
  ],
  "turn_summary": "One sentence factual summary, past tense, no em dashes."
}`;

    const raw = await callClaude(NARRATOR_SYSTEM, userMsg, 600);
    const result = extractJSON(raw);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('battle-narrator error:', err);
    return new Response(
      JSON.stringify({
        narration_lines: [
          { line: 'The combatants clash in a burst of raw energy.', character: 'both', action: 'movement' },
          { line: 'Neither yields ground.', character: 'both', action: 'attack' },
          { line: 'The exchange settles.', character: 'both', action: 'neutral' },
        ],
        turn_summary: 'Turn resolved with an exchange of moves.',
      }),
      {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      }
    );
  }
});
