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

// NPC GENERATION

const NPC_SYSTEM = `You are the Framework Master AI governing the Arch:Genesis universe. Design a complete, cohesive NPC opponent. Think of them as a real fighter with a distinct combat identity, not a random assortment of stats. Return ONLY a raw JSON object, no markdown, no code blocks, no explanation.`;

const NPC_USER = `Design a unique NPC cypher opponent with a coherent combat identity.

DESIGN RULES:
- Name should feel like it belongs in a digital/cyber universe (examples: Tessera-7, Phantom-X, Nullvane, Grix, Oblivion-3, Serrath, Warden-0)
- Kit abilities must have SYNERGY. They should form a cohesive fighting system, not random moves. A fast aggressive cypher might chain Burst into Cascade into Rupture. A heavy defensive one might use Fortress, Anchoring, and Counterdrive.
- Weakness must be THEMATICALLY CONNECTED to their strengths. A heavily armored defensive cypher is weak to relentless pressure that never lets it anchor. A fast aggressive cypher is weak to patience and precise timing.
- Visual style should be specific and evocative.
- Battle profile (description) must read like a scouting report written by someone who has fought them: what are their patterns, how do they open, what do they do when pressured, what is their signature moment.

Return exactly this JSON:
{
  "name": "...",
  "visualStyle": "One of: Crystalline, Organic, Geometric, Ethereal",
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
  "weakness": "One of: Energy Vulnerable, Physical Vulnerable, Low Mobility, Fragile Structure",
  "description": "2-3 sentences: how they fight, their personality in combat, what makes them dangerous, written as a scouting report"
}`;

// TURN RESOLUTION

const BATTLE_SYSTEM = `You are the Framework Master, the AI intelligence that governs all battles in the Arch:Genesis universe.

BATTLE RULES:
- Advantage score: integer -10 to +10 (player perspective, starts at 0)
- advantage_delta per turn: typically -3 to +3, rarely +/-4 for dramatic moments
- new_advantage_score = clamp(old + delta, -10, 10)
- Battle is 7 turns maximum

CONDITION STATES (from new_advantage_score):
- Player: <= -6 Desperate, <= -4 Critical, <= -2 Pressured, else Stable
- Opponent: >= 6 Desperate, >= 4 Critical, >= 2 Pressured, else Stable

BATTLE PHASES: "early" turns 1-2, "mid" turns 3-4, "late" turns 5-7

SPECIAL MECHANICS:
- weakness_finisher_available: true when score >= 6 AND current_turn >= 5
- opponent_weakness_finisher_available: true when score <= -6 AND current_turn >= 5. If triggered, opponent lands it. Set is_battle_over: true, winner: "opponent"
- lucky_way_out_active: true when score <= -4. Provide lucky_way_out_path: ["move1 desc", "move2 desc"]
- turn_winner: "player" if delta > 0, "opponent" if delta < 0, "draw" if 0

FULL CONTEXT INJECTION:
You receive the COMPLETE match history, key moments array, pattern tracker, and momentum tracker. Use ALL of it actively. The battle must feel like it has memory and continuity from turn 1 onward.

KEY MOMENT DETECTION:
Tag the following in key_moments_this_turn (array of descriptive strings):
- advantage_delta magnitude >= 3 in either direction: "Turn [N]: [PlayerName] landed [ability] for a +[delta] swing"
- lucky_way_out_active triggers this turn: "Turn [N]: Lucky Way Out opened for [PlayerName]"
- weakness_finisher_available becomes true this turn: "Turn [N]: Weakness finisher window opened for [PlayerName]"
- A condition state changes compared to last turn (either fighter): "Turn [N]: [Name] dropped to [NewCondition]"
- Same ability used 3 turns in a row by either side: "Turn [N]: [Name] used [ability] for the third consecutive turn"

OPPONENT AI: Plays to win. Has full memory of the entire fight. Uses its own kit contextually.
- Check pattern_tracker. If player has used any ability 2 or more times, the opponent anticipates it. On the 3rd use, the opponent counters it specifically and the opponent_move_reasoning must name this explicitly.
- Opponent never uses the same ability twice in a row unless pressing a clear advantage.
- Opponent uses its defense ability when its condition is Pressured, Critical, or Desperate.
- Opponent uses its passive when its logical trigger conditions are met based on match state.
- Turns 5-7: escalate aggression regardless of advantage state. Late phase means higher risk, higher reward decisions. Do not play conservatively in late phase.
- Reference key_moments: if the player landed a big hit earlier, the opponent adapts its strategy to prevent it from happening again. Make this visible in opponent_move_reasoning.

MOVE GENERATION: 4 player options. Every rule below is mandatory.

RULE 1, LAST TURN RESPONSE:
Every option must directly reference what happened in the previous turn. If opponent countered the player, offer specific ways to break that counter. If player landed a strong hit, offer ways to press that exact opening further. Never write options as if the previous turn did not happen.

RULE 2, KEY MOMENT ECHO:
If key_moments (from previous turns) contains any entries, at least one option must reference a specific earlier key moment by name and turn number. Examples: "They used that same formation in turn 3. You know what comes next. Counter it with your [DefenseAbility] before it lands again." or "The opening you created in turn 2 is still there. Drive your [Special1] directly into it."

RULE 3, PATTERN PUNISHMENT:
If player_pattern_detected is true or pattern_tracker shows any ability used 2 or more times, one option MUST explicitly call out the pattern and offer a specific alternative. Example: "Your pattern is readable. Three times you opened with [BasicAttack]. Shift to [Special2] and catch them mid-adaptation." The call-out must name the overused ability.

RULE 4, KIT GROUNDING:
Every option must use the player's actual ability names embedded organically in the description. Never write "use your special attack." Write "channel your Overload into the fracture you opened last turn." The ability name is part of the sentence naturally.

RULE 5, PASSIVE TRIGGER:
If the current battle state logically triggers the passive (momentum shift, opponent pressured, player just absorbed a hit, player just won the previous turn), one option must frame activating the passive as a tactical decision. If turn_number >= 4 and pattern_tracker shows the passive has been used 0 times, the passive MUST appear as an option regardless of state.

MATCH NARRATIVE STATE:
Determine the overall story arc and output as match_narrative_state:
- "opening": current_turn is 1 or 2
- "player_pressing": new_advantage_score >= 3 and momentum_tracker favors player
- "opponent_pressing": new_advantage_score <= -3 and momentum_tracker favors opponent
- "comeback": momentum_tracker reversed direction in the last 2 turns (was opponent-leaning, now player-leaning, or vice versa)
- "desperation": any fighter at Desperate condition
- "climax": current_turn >= 6
When multiple states apply, prefer in this order: climax, desperation, comeback, player_pressing, opponent_pressing, opening.

EM DASHES PROHIBITED: Never use the em dash character or double hyphens as dashes in any string output. Use commas, colons, or period breaks instead.

Return ONLY raw JSON, no markdown, no code blocks, no explanation.`;

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
    key_moments,
    pattern_tracker,
    momentum_tracker,
  } = body;

  // Full match history (all turns, no slice)
  const historyText = move_history.length === 0
    ? 'None. This is the opening turn.'
    : move_history.map((m: any) =>
        `Turn ${m.turn_number}: Player used "${m.player_move}" | Opponent used "${m.opponent_move}" | Delta: ${m.advantage_delta > 0 ? '+' : ''}${m.advantage_delta} | Winner: ${m.turn_winner ?? 'unknown'}${m.description ? ` | "${m.description}"` : ''}`
      ).join('\n');

  // Key moments from earlier turns
  const keyMomentsText = (key_moments ?? []).length === 0
    ? 'None yet.'
    : (key_moments as string[]).join('\n');

  // Pattern tracker
  const patternEntries = Object.entries(pattern_tracker ?? {})
    .filter(([, count]) => (count as number) > 0)
    .map(([ability, count]) => `${ability}: ${count} uses`)
    .join(', ');
  const patternTrackerText = patternEntries || 'No abilities recorded yet.';

  // Pattern detection for explicit flagging
  let playerPatternDetected = false;
  let patternDescription = '';
  const kitAbilities = [
    { key: 'basicAttack', name: p.kit.basicAttack },
    { key: 'special1', name: p.kit.special1 },
    { key: 'special2', name: p.kit.special2 },
    { key: 'defense', name: p.kit.defense },
    { key: 'passive', name: p.kit.passive },
  ];
  for (const ability of kitAbilities) {
    const count = (pattern_tracker ?? {})[ability.key] ?? 0;
    if (count >= 2) {
      playerPatternDetected = true;
      patternDescription = `Player has used ${ability.name} ${count} times this match. Pattern is readable.`;
      break;
    }
  }

  // Momentum tracker
  const recentMomentum = (momentum_tracker ?? []).slice(-3) as string[];
  const momentumText = recentMomentum.length === 0
    ? 'No turns resolved yet.'
    : recentMomentum.join(', ') + ` (last ${recentMomentum.length} turns)`;

  const lastTurn = move_history.length > 0 ? move_history[move_history.length - 1] : null;
  const lastTurnContext = lastTurn
    ? `Last turn: Player used "${lastTurn.player_move}" | Opponent used "${lastTurn.opponent_move}" | Result: ${lastTurn.turn_winner ?? 'unknown'}`
    : 'No previous turns.';

  return `Resolve this battle turn.

PLAYER CYPHER: ${p.name}
Visual Style: ${p.visualStyle} | Size: ${p.sizeClass} | Mobility: ${p.mobility} | Material: ${p.material} | Combat Style: ${p.combatStyle}
Kit: Basic: ${p.kit.basicAttack} | Special1: ${p.kit.special1} | Special2: ${p.kit.special2} | Defense: ${p.kit.defense} | Passive: ${p.kit.passive}
Weakness: ${p.kit.weakness}
Battle Profile: ${p.description}

OPPONENT CYPHER: ${o.name}
Visual Style: ${o.visualStyle} | Size: ${o.sizeClass} | Mobility: ${o.mobility} | Material: ${o.material} | Combat Style: ${o.combatStyle}
Kit: Basic: ${o.kit.basicAttack} | Special1: ${o.kit.special1} | Special2: ${o.kit.special2} | Defense: ${o.kit.defense} | Passive: ${o.kit.passive}
Weakness: ${o.kit.weakness}
Battle Profile: ${o.description}

CURRENT STATE:
Advantage Score: ${advantage_score} (player perspective)
Turn: ${current_turn}/7 | Phase: ${battle_phase}
Initiative this turn: ${initiative_winner} moved first
Player selected move: "${player_selected_move}"

IMMEDIATE CONTEXT:
${lastTurnContext}
Pattern detected: ${playerPatternDetected ? patternDescription : 'None.'}

PATTERN TRACKER (player ability usage this match):
${patternTrackerText}

MOMENTUM TRACKER (recent turn outcomes):
${momentumText}

KEY MOMENTS FROM THIS MATCH:
${keyMomentsText}

FULL MATCH HISTORY:
${historyText}

Return this exact JSON:
{
  "opponent_move": "ability name used",
  "opponent_move_description": "one sentence describing the opponent action and intent, no em dashes",
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
    {"id": "opt_1", "action_description": "organic description embedding the ability name, no em dashes", "is_weakness_finisher": false, "is_lucky_way_out_step": false},
    {"id": "opt_2", "action_description": "...", "is_weakness_finisher": false, "is_lucky_way_out_step": false},
    {"id": "opt_3", "action_description": "...", "is_weakness_finisher": false, "is_lucky_way_out_step": false},
    {"id": "opt_4", "action_description": "...", "is_weakness_finisher": false, "is_lucky_way_out_step": false}
  ],
  "battle_phase": "early" | "mid" | "late",
  "is_battle_over": true | false,
  "winner": "player" | "opponent" | null,
  "last_turn_context": "one sentence tactical situation informing the move options, no em dashes",
  "opponent_move_reasoning": "one sentence explaining why opponent chose this specific move, no em dashes",
  "key_moments_this_turn": ["descriptive string for each key moment this turn"],
  "player_pattern_detected": ${playerPatternDetected},
  "pattern_description": ${playerPatternDetected ? `"${patternDescription}"` : 'null'},
  "match_narrative_state": "opening" | "player_pressing" | "opponent_pressing" | "comeback" | "desperation" | "climax"
}`;
}

// HANDLER

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
