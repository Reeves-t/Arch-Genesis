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

const NARRATOR_SYSTEM = `You are the Narrator of Arch:Genesis battles. A cinematic voice that describes combat like a sports announcer crossed with a fantasy novelist. Present tense. Visceral. Alive. The battle reads like a story that started in turn 1 and is building toward something, not a series of disconnected exchanges.

ABSOLUTE RULES:
- NEVER use em dashes (-- or the character). Use commas, semicolons, colons, or period breaks instead.
- Write exactly 4 lines of narration per turn.
- Each line references one character: "player", "opponent", or "both".
- Never say "weakness", "finisher", "health points", "HP", "game mechanics", or break the fourth wall.
- Each line is one complete dramatic sentence in present tense.
- The final line MUST be tagged "both" and MUST clearly state who won the exchange or declare a draw. No ambiguity.

ABILITY NAME INTEGRATION:
- Reference specific ability names from both cyphers naturally within the prose.
- NOT: "Player used Overload". YES: "The Overload blast tears through the gap [OpponentName] just exposed."
- NOT: "Opponent activated Shield Wall". YES: "[OpponentName]'s Shield Wall snaps up like a reflex, eating the brunt of the strike."
- Ability names are things that exist in the world of the fight, not labels.

MATCH NARRATIVE STATE: Use match_narrative_state to set the overall tone of this turn's narration.
- "opening": Atmospheric, each fighter establishing presence and style. The world of the fight is being defined.
- "player_pressing": Confident, aggressive. The player is dictating terms. The opponent is reacting.
- "opponent_pressing": Tense, reactive. The player is scrambling. The opponent is hunting.
- "comeback": Desperate but electric. Something shifted. The momentum changed and both fighters feel it.
- "desperation": Last stand energy. Every line feels like it could be the final one. Stakes are absolute.
- "climax": Everything has been building to this. The weight of every previous turn is present in every line.

MEMORY AND CALLBACKS: The narration must feel like it has memory.
- Use key_moments_this_turn to identify anything notable happening right now worth referencing.
- Use match_history to call back to earlier turns when relevant. If a move from turn 1 is echoed in turn 6, reference it. "This is the same opening. But this time you are ready."
- If a key moment from an earlier turn is relevant to what just happened, name it. "The same formation that cost them in turn 3 opens up again."

OPPONENT INTELLIGENCE: Use player_pattern_detected and pattern_description to write the opponent as adaptive and aware.
- If the opponent is reading the player's pattern, the narration must make it feel ominous. "Serrath tilts its head. It has seen this before. Three times now."
- The opponent is not just reacting. It is thinking, adapting, hunting.

TACTICAL RESPONSIVENESS:
- Use last_turn_context to show the tactical situation through action, not description.
- Use opponent_move_reasoning to give the opponent visible intent.

STRUCTURE (follow this order every turn):
1. First line: Show who moved first through action based on initiative_winner, not announcement.
2. Middle lines (2): Full exchange. Ability names woven in. Opponent intent visible. Callbacks to earlier turns if relevant.
3. Final line: Tagged "both". Conclusive. Player won: they pressed the advantage, opponent was pushed back. Opponent won: opponent landed the better exchange. Draw: brutal even exchange. This line must be unambiguous.

SPECIAL CASES:
- Lucky Way Out active: Desperation and a sliver of hope in the same breath.
- Battle over via decisive blow: The most cinematic treatment of the entire fight. Reference the journey.
- Draw at turn 7: Brutal exhaustion, hard-fought stalemate, both fighters changed by the exchange.

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
      key_moments_this_turn,
      player_pattern_detected,
      pattern_description,
      match_narrative_state,
    } = await req.json();

    const tr = turn_result;

    // Full match history for deep callbacks (all turns with moves and outcomes)
    const fullHistoryText = (move_history ?? []).length === 0
      ? 'Opening exchange, no prior history.'
      : (move_history as any[]).map((m) =>
          `Turn ${m.turn_number}: ${m.player_move ? `Player: "${m.player_move}"` : ''} ${m.opponent_move ? `Opponent: "${m.opponent_move}"` : ''} | ${m.turn_winner === 'player' ? 'Player won' : m.turn_winner === 'opponent' ? 'Opponent won' : 'Draw'}${m.narration_summary ? ` | "${m.narration_summary}"` : ''}`
        ).join('\n');

    const advantageDesc = tr.advantage_delta > 0
      ? `${player_cypher.name} gains ground (+${tr.advantage_delta})`
      : tr.advantage_delta < 0
        ? `${opponent_cypher.name} gains ground (${tr.advantage_delta})`
        : 'Neither gains clear advantage (0)';

    const turnResultDesc = turn_winner === 'player'
      ? `${player_cypher.name} won this exchange, pressed the advantage`
      : turn_winner === 'opponent'
        ? `${opponent_cypher.name} won this exchange, landed the better hit`
        : 'Even exchange, neither yielded';

    const initiativeDesc = initiative_winner === 'player'
      ? `${player_cypher.name} had initiative and committed first`
      : `${opponent_cypher.name} had initiative and committed first`;

    const keyMomentsNow = (key_moments_this_turn ?? []) as string[];
    const keyMomentsText = keyMomentsNow.length > 0
      ? keyMomentsNow.join('; ')
      : 'No key moments flagged this turn.';

    const patternText = player_pattern_detected && pattern_description
      ? `PATTERN ACTIVE: ${pattern_description}`
      : 'No player pattern detected.';

    const narrativeState = match_narrative_state ?? 'opening';

    const userMsg = `Narrate this battle turn.

FIGHTERS:
${player_cypher.name} (player): ${player_cypher.description}
Kit: ${player_cypher.kit.basicAttack} / ${player_cypher.kit.special1} / ${player_cypher.kit.special2} / ${player_cypher.kit.defense} / ${player_cypher.kit.passive}

${opponent_cypher.name} (opponent): ${opponent_cypher.description}
Kit: ${opponent_cypher.kit.basicAttack} / ${opponent_cypher.kit.special1} / ${opponent_cypher.kit.special2} / ${opponent_cypher.kit.defense} / ${opponent_cypher.kit.passive}

TURN ${current_turn}/7, PHASE: ${battle_phase.toUpperCase()}:
Initiative: ${initiativeDesc}
Player action: "${tr.player_selected_move ?? 'their chosen move'}"
Opponent action: "${tr.opponent_move}" - ${tr.opponent_move_description}
Outcome: ${advantageDesc}
Turn result: ${turnResultDesc}
Conditions: ${player_cypher.name} is ${tr.player_condition} | ${opponent_cypher.name} is ${tr.opponent_condition}
Lucky Way Out active: ${tr.lucky_way_out_active}
Battle over: ${tr.is_battle_over}${tr.winner ? ` - ${tr.winner === 'player' ? player_cypher.name : opponent_cypher.name} wins` : ''}

MATCH NARRATIVE STATE: ${narrativeState}
Use this to set the overall tone of this turn's narration.

TACTICAL CONTEXT:
${last_turn_context ?? 'Opening exchange.'}

OPPONENT INTENT THIS TURN:
${opponent_move_reasoning ?? 'Opponent made its move.'}

PATTERN INTELLIGENCE:
${patternText}

KEY MOMENTS THIS TURN:
${keyMomentsText}

FULL MATCH HISTORY (use for callbacks and memory):
${fullHistoryText}

Return exactly this JSON (4 lines, final line always "both", final line always unambiguous about who won or if it was a draw):
{
  "narration_lines": [
    {"line": "Initiative line: first mover commits through action, no em dashes.", "character": "player"},
    {"line": "Exchange line weaving in ability names, callbacks to history if relevant.", "character": "opponent"},
    {"line": "Reaction or escalation, opponent intent visible, pattern awareness if detected.", "character": "player"},
    {"line": "Conclusive round-result line. Who won the exchange is unambiguous. No em dashes.", "character": "both"}
  ],
  "turn_summary": "One sentence factual summary, past tense, no em dashes."
}`;

    const raw = await callClaude(NARRATOR_SYSTEM, userMsg, 1200);
    const result = extractJSON(raw);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('battle-narrator error:', err);
    return new Response(JSON.stringify({
      narration_lines: [
        { line: 'The combatants clash in a burst of raw energy.', character: 'both' },
        { line: 'Neither yields ground easily.', character: 'both' },
      ],
      turn_summary: 'Turn resolved with an exchange of moves.',
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
