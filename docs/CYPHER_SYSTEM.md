# Arch:Genesis — Cypher System Reference
Last updated: 2026-03-16

## Genesis Wizard Steps
1. Sketch — optional drawing + cypher visual description for image generation
2. Identity — Name, Origin Log (Visual Style removed)
3. Structure — Size Class, Mobility, Combat Style (Material removed). All have preset options plus Custom free text input. AI maps custom inputs to nearest standard equivalent for stat derivation.
4. Kit — Basic Attack, Special 1, Special 2, Defense, Passive, Weakness, Battle Profile, Cypher Description
4.5. Stats — View derived base stats, manually allocate 6 bonus points
5. Review — Full cypher summary before Complete Genesis

## Structure Options
**Size Class:** Compact | Standard | Heavy | Custom
**Mobility:** Agile | Balanced | Grounded | Custom
**Combat Style:** Aggressive | Tactical | Defensive | Custom

**Custom Input Rule:** Custom structure text is mapped by AI to nearest standard equivalent for stat calculation only. Custom text feeds into battle narration and Framework Master flavor context. Custom inputs do NOT create new stat categories.

Custom mapping examples:
- Size: Microscopic/Tiny → Compact, Colossal/Giant → Heavy, Medium/Average → Standard
- Mobility: Slithering/Crawling → Balanced, Quantum/Phase/Flash → Agile, Lumbering/Slow → Grounded
- Combat: Ambush/Berserker → Aggressive, Counter/Reactive → Tactical, Fortress/Shield → Defensive

## The 6 Core Stats

### 1. Movement Speed
What it does: Number of cells cypher can move per turn on the battle grid.
Base derivation (Mobility + Size):
- Agile + Compact = 6
- Agile + Standard = 5
- Agile + Heavy = 4
- Balanced + Compact = 4
- Balanced + Standard = 3
- Balanced + Heavy = 3
- Grounded + Compact = 3
- Grounded + Standard = 2
- Grounded + Heavy = 2
Max cap: 8
Bonus points allowed: 0-2

### 2. Attack Range
What it does: Number of cells basic attack can reach on grid.
Base derivation (Combat Style):
- Aggressive = 1 (melee)
- Tactical = 4 (mid range)
- Defensive = 6 (ranged)
Max cap: 8
Bonus points allowed: 0-2

### 3. Melee Power
What it does: Advantage delta bonus when attacking at 1-2 cell range.
Base derivation (Size):
- Compact = 4
- Standard = 6
- Heavy = 8
Max cap: 10
Bonus points allowed: 0-2

### 4. Defense Rating
What it does: Reduces advantage delta loss when taking a hit.
Base derivation (Combat Style):
- Aggressive = 3
- Tactical = 5
- Defensive = 7
Max cap: 10
Bonus points allowed: 0-2

### 5. Special Range
What it does: How far special abilities reach on the grid.
Base derivation (ability keyword scanning):
- Melee keywords (strike, slam, punch, claw, cut) = 1
- Burst/aura keywords (pulse, wave, aura, burst, explode) = 3
- Beam/blast keywords (beam, blast, shot, ranged, projectile, fire) = 5
- Movement keywords (teleport, dash, charge, phase) = equals movement_speed value
- Default if no keyword match = 3
Max cap: 8
Bonus points allowed: 0-2

### 6. Initiative
What it does: Determines who acts first each turn. Higher initiative acts first. Tiebreak = random coin flip stored at battle start.
Base derivation (Mobility + Size):
- Agile + Compact = 8
- Agile + Standard = 7
- Agile + Heavy = 6
- Balanced + Compact = 6
- Balanced + Standard = 5
- Balanced + Heavy = 4
- Grounded + Compact = 4
- Grounded + Standard = 3
- Grounded + Heavy = 2
Max cap: 10
Bonus points allowed: 0-2

## Bonus Point Allocation Rules
- Every cypher gets exactly 6 bonus points at creation
- Player allocates manually on Step 4.5 of Genesis Wizard
- Maximum 2 bonus points into any single stat
- All 6 points must be allocated before proceeding to Review
- First allocation is FREE — no cost
- After cypher creation any stat changes cost Frame Points (see MONETIZATION.md)
- Stat reroll (fresh AI suggested distribution) = 75 FP
- Single stat adjustment = 30 FP per stat

## Critical Rule — Descriptions Do Not Affect Stats
Stats are derived EXCLUSIVELY from Structure choices and bonus point allocation.
Cypher visual descriptions, origin logs, battle profiles, and ability descriptions do NOT affect stat values regardless of language used.
Ability descriptions are scanned for Special Range keyword matching only — this is the single exception.
This rule must be enforced in all stat derivation logic and communicated to players on Step 4.5.

## Battle Grid Reference
Grid size: 13 columns x 7 rows
Player starting position: {x: 1, y: 4}
Opponent starting position: {x: 13, y: 4}
Cell size: 28px x 28px
Movement per turn = movement_speed stat value
Attack connects only if target is within attack_range cells of attacker
See BATTLE_SYSTEM.md for full grid mechanics

## Stat Display on Cypher Sheet
Stats section appears below KIT section.
Display all 6 stats with label, value, and a proportional bar visualization.
Bar fills to percentage of max cap.
Movement Speed bar color: cyan
Attack Range bar color: orange
Melee Power bar color: red
Defense Rating bar color: blue
Special Range bar color: purple
Initiative bar color: yellow

## Version History
v1.0 — Initial stat system. Removed Material and Visual Style from structure. Added 6 core stats with bonus point allocation. Grid system 13x7.
