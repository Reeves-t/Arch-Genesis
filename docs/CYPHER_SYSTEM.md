# Arch:Genesis — Cypher System Reference
Last updated: 2026-03-17

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

## Pose System

### Image Hierarchy (fallback chain)
Battle grid always uses this priority order:
1. Pose-specific directional URL (attackRightUrl, defendLeftUrl, etc.)
2. Default directional URL (imageRightUrl or imageLeftUrl)
3. Main identity image (imageUrl)
4. Letter placeholder

### Grid Facing Rules
- Player side: always use _right variants
- Opponent side: always use _left variants
- Opponent image rendered with `scaleX: -1` transform as additional facing correction

### Generation Pipeline
1. User selects variant from 3 Grok Imagine text-to-image options
2. `generationPrompt` and `generationSeed` saved to wizard state at variant selection
3. `generateDirectionalImages` runs SEQUENTIALLY at cypher creation end (not at image selection)
   - Front facing (strength 0.25, seed)
   - Right facing (strength 0.25, seed+1)
   - Left facing (strength 0.25, seed+2)
4. `removeBackgroundSequential` runs on all 3 directional results
5. All 3 uploaded to Supabase Storage at `cypher-images/{userId}/{cypherId}/`
6. `generation_prompt` and `generation_seed` saved to cyphers table for future pose consistency
7. Cypher creation loading screen shows progressive status text during this phase

### Default Battle Pose Timing
The left and right default battle poses are generated ONLY at the end of cypher creation (the "Complete Genesis" step), NOT when the user selects an image variant. This means the creation loading screen will remain active until both directional images are fully generated and uploaded.

### Pose Generation (Attack / Defend)
- Uses `generatePoseImage` function in `lib/falClient.ts`
- Attack pose: uses `kit.basicAttack` as pose description
- Defend pose: uses `kit.defense` as pose description
- Strength 0.3 — slightly more deviation than directionals for expressive poses
- Sequential generation: right then left
- Background removal runs on each result
- Available from Pose Hub on the cypher sheet (Poses tab)

### Pose Trigger Timing in Battle
- Attack pose: shows for 2 seconds when player executes an attack move
- Defend pose: shows for 2 seconds when player executes a defensive move
- Opponent pose determined by parsing opponent_move text from Framework Master
- After 2 seconds both sides return to idle directional image

### Pose Hub (Cypher Sheet → Poses Tab)
- Toggle between Sheet and Poses views using the tab bar at the top of the main display
- DEFAULT BATTLE POSES section: shows front, right (player), left (opponent) — auto-generated at creation
- ATTACK POSE section: generate button → right and left angle images
- DEFEND POSE section: generate button → right and left angle images
- Generation requires `imageUrl`, `generationPrompt`, and `generationSeed` to be set (Genesis Wizard cyphers only)
- Seed cyphers without these fields will see the generation button disabled

### Database Columns (cyphers table)
| Column | Purpose |
|--------|---------|
| `image_url` | Primary identity image (front-facing, shown on sheet) |
| `image_front_url` | Explicit front-facing battle pose |
| `image_right_url` | Right-facing battle pose (player side on grid) |
| `image_left_url` | Left-facing battle pose (opponent side on grid) |
| `attack_right_url` | Attack pose facing right |
| `attack_left_url` | Attack pose facing left |
| `defend_right_url` | Defend pose facing right |
| `defend_left_url` | Defend pose facing left |
| `generation_prompt` | Full prompt used for initial generation |
| `generation_seed` | Seed used for initial generation |
| `poses_generated_at` | Timestamp when directional poses were created |

### Current Pose Types
- idle (default directional)
- attack
- defend

(Planned: special, victory, defeat, finisher)

## 3D Model Pipeline (Current)

### Default Model Generation
After cypher creation image is finalized:
1. PNG sent to Tripo via FAL endpoint: `tripo3d/tripo/v2.5/image-to-3d`
2. GLB returned and uploaded to `cypher-models` Supabase Storage bucket
3. Public URL saved as `model_url` in cyphers table
4. Cost: $0.20-0.40 per model via FAL key

### Pose Model Generation
For attack and defend poses:
1. flux/dev/image-to-image generates posed PNG from base image (strength 0.45)
2. Posed PNG sent to Tripo for 3D conversion
3. GLB uploaded to `cypher-models/{userId}/{cypherId}/{poseType}_set{N}_{ts}.glb`
4. URL saved to `cypher_pose_sets.model_url`
5. `generation_method = 'tripo'`

### Storage Buckets
- `cypher-images` — PNG files (image_url, original generated images)
- `cypher-models` — GLB files (model_url, pose GLBs)

### Facing Direction
No separate left/right models needed.
Rotate GLB on Y axis in Three.js / expo-three scene:
- Player side: `rotation.y = 0` (facing right)
- Opponent side: `rotation.y = Math.PI` (facing left)

### Legacy PNG Directional System
Commented out in lib/falClient.ts
Functions: `generateDirectionalImages`, `removeBackgroundSequential`
Reason: Replaced by Tripo single-model approach
Safe to delete after 3D pipeline is confirmed stable

### 2D PNG Kept For
- Roster list thumbnail (fast loading)
- Cypher sheet header image
- Battle portrait above grid (until 3D viewer built)
- Any UI where GLB is too heavy to load

### GLB Used For
- Battle grid character model
- 3D viewer on cypher sheet
- Pose animations in battle
- Cypher card 3D preview

## Version History
v1.0 — Initial stat system. Removed Material and Visual Style from structure. Added 6 core stats with bonus point allocation. Grid system 13x7.
v1.1 — Pose system. Directional battle poses (front/right/left) generated at cypher creation. Attack and defend poses generated on demand from Pose Hub. Grid renders PNG character images with facing. Battle screen tracks pose state per turn.
v1.2 — 3D pipeline. Replaced directional PNG generation with Tripo GLB. Single model per cypher, Y-axis rotation handles facing. Pose GLBs generated via img2img + Tripo. Storage split: cypher-images (PNG) and cypher-models (GLB).
