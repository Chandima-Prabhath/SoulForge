# SoulForge

> *An anime-style isometric action RPG where you are summoned into a fractured realm with the unique skill **[Devour]**. Absorb essence, analyze foes, forge infinite skills from a compositional grammar, and grow without limit across roguelite realms.*

---

## 0. Table of Contents

1. [Vision](#1-vision)
2. [Design Pillars](#2-design-pillars)
3. [The Third Path — Why Not Hardcode, Why Not AI](#3-the-third-path--why-not-hardcode-why-not-ai)
4. [Core Mechanics](#4-core-mechanics)
5. [The Divergence Problem — SoulForge's Answer](#5-the-divergence-problem--soulforges-answer)
6. [Game Structure — Three Layers](#6-game-structure--three-layers)
7. [Narrative Approach](#7-narrative-approach)
8. [Visual & Audio Direction](#8-visual--audio-direction)
9. [Tech Stack](#9-tech-stack)
10. [Architecture](#10-architecture)
11. [Roadmap](#11-roadmap)
12. [Phase 0 Scope](#12-phase-0-scope)
13. [Development](#13-development)
14. [Glossary](#14-glossary)
15. [Design Constitution](#15-design-constitution)

---

## 1. Vision

SoulForge is a love letter to:

- **That Time I Got Reincarnated as a Slime (Tensura)** — Rimuru's Predator/Gluttony, Analysis, Skill Synthesis, Mimicry, Evolution, the Voice of the World, and Great Sage/Raphael.
- **Arena of Valor (AoV)** — fast-paced isometric MOBA combat feel, ability slots, minion waves, structures, boss fights.
- **Path of Exile / Noita** — compositional skill systems where builds are emergent, not predefined.
- **Hades / Binding of Isaac** — roguelite run structure with meta-progression.

The player is **the anomaly**: an isekai'd soul summoned with a power no one else has — `[Devour]`. Every enemy felled leaves essence. Every essence devoured reveals a fragment of the world's grammar. From those fragments, the player forges skills that no one has ever cast before.

**The dream**: a game with effectively infinite growth, where two players who start on the same day will, a year later, have completely different builds, grimoires, and stories — not because the game branched narratively, but because the mechanics make convergence impossible.

---

## 2. Design Pillars

Five non-negotiable principles. Every feature must serve at least one.

### Pillar 1: Devour to Grow
Every defeated enemy leaves essence. Devour essence to analyze, mimic, and synthesize new skills. Growth is earned through consumption, not granted through quests.

### Pillar 2: Craft Your Power
Skills are not chosen from a list. Skills emerge from a compositional grammar (Element × Form × Vector × Modifiers). The player discovers their build by experimenting.

### Pillar 3: Realms Shift
Realms are procedurally generated per run. Death returns you to the Sanctum with partial loss and partial retention (roguelite meta-progression). No two runs are identical.

### Pillar 4: Guided, Not Lost
The Voice of the World and the inner Sage provide diegetic, concise guidance. No sandbox paralysis. No Genshin-scale cutscenes. Light but present.

### Pillar 5: Match-Ready
Self-contained 10–20 minute matches (AoV DNA) exist alongside story realms. Quick-play always available.

---

## 3. The Third Path — Why Not Hardcode, Why Not AI

### The Problem
The original dream: "a game with infinite growth and new skill manifestation, not hardcoded."

Two naive paths:
- **Hardcode everything** → finite, predictable, dies when content runs out.
- **Use an LLM/AI at runtime** → expensive, unpredictable, impossible to balance, can't run server-side at scale, and not a path the developer can walk.

### The Solution: Compositional Emergence
There is a third path used by chess, Magic: The Gathering, Noita, and Path of Exile:

> **Don't define skills. Define the grammar that generates skills.**

A skill in SoulForge is a **data object** describing how atoms combine. The engine interprets that data. The number of valid skills is the product of atoms across layers — astronomically large from a small finite set.

- 10 elements × 5 forms × 4 vectors × 10 modifiers = **2,000 unique skills** from just 29 atoms.
- Add a second modifier slot: **20,000 skills**.
- Add a third: **200,000 skills**.

We add atoms over time. We never hardcode "Fireball." The dream is realized through grammar, not genies.

---

## 4. Core Mechanics

### 4.1 The Skill Grammar

A skill is composed of layers, each drawn from a finite set of atoms:

| Layer | Purpose | Examples |
|---|---|---|
| **Element** | The "what" — the nature of the effect | Fire, Frost, Lightning, Void, Time, Gravity, Soul, Blood, Mind, Dream, Echo, Mirror, Karma |
| **Form** | The "shape" of the effect | Projectile, Beam, Nova, Wall, Aura, Trap, Summon, Sigil, Chain, Storm, Rift |
| **Vector** | The "where/how" — delivery method | Self, Touch, Ranged, Homing, Ground-targeted, Cone, Sphere, Tethered |
| **Modifiers** | Stackable traits (1–3 slots) | Split, Pierce, Bounce, Linger, Grow, Echoes-after-2s, Chains-to-3, Converts-on-kill, Mutates-with-low-HP |

**Example emergent skills** (none hardcoded):

- `Fire + Beam + Chain + Split-on-kill` → a fire laser that arcs between enemies and splits when it kills.
- `Time + Nova + Linger + Slow-modifier` → a time bubble that slows everything in radius and persists.
- `Void + Summon + Mirror + Echoes` → summon a void shade that copies your last 3 casts.
- `Blood + Curse + Tether + Grows-with-damage-taken` → a blood leash that drains harder as you take damage.

### 4.2 Devour (The Core Loop)

```
Kill enemy → enemy leaves [Essence Shard]
Devour shard → triggers [Analysis] → reveals what skills the enemy had
  ├─ If new grammar atom discovered → unlocks it (e.g., 「Frost element unlocked」)
  ├─ If known skill → adds to your [Skill Library]
  └─ Special enemies (bosses) → grant [Mimicry Form]
```

### 4.3 Skill Synthesis (At the Sanctum)

```
Take 2+ skills from your library
  → Combine them
  → Result: rarer skill or new modifier
  → e.g., [Fireball] + [Chain Lightning] = [Chain Fireball]
```

This is Rimuru's Skill Synthesis, mechanically formalized.

### 4.4 Skill Ascension (Passive)

```
Cast a skill 100 / 500 / 1000 times → it evolves with a new modifier
  → e.g., [Fireball] used 500x → evolves into [Greater Fireball] (+25% radius)
```

### 4.5 Mimicry

Devour a creature → take its form. Changes base stats and unlocks that creature's available forms. (Rimuru's Mimicry.)

### 4.6 The MC's Starting Kit

- `[Devour]` — core unique skill, unchangeable. The isekai gift.
- `[Mana Bolt]` — basic attack. A simple Projectile + Force element.
- `[Phase Step]` — short dash. Defensive repositioning.
- 1 empty slot reserved for absorbed skills.

### 4.7 Resource: Magicule (Mana/Aura)

Grows over time, gates high-tier skills. Tied to devour history — the more you've devoured, the larger your magicule pool.

---

## 5. The Divergence Problem — SoulForge's Answer

### The Problem
If every player starts at the same point with the same rules, optimization converges. MMOs/ARPGs end up with one meta build everyone copies. Multiplayer makes it worse — metas spread through chat.

The cause isn't seeds. The cause is **convergence pressure**: small state space + fixed rules = single optimum.

### The Solution: Five Layers of Divergence

#### Layer 1: Per-Player "Essence Salt" in the Seed

The realm seed isn't just `12345`. It's:

```
finalSeed = hash(
  realmSeed,         // shared per realm tier
  playerEssenceSalt, // unique per player, evolves over time
  runNumber          // which run for this player
)
```

`playerEssenceSalt` is derived from everything the player has done — most-used skills, favored elements, death count, devour history. It changes over time. Two players entering "the same realm" actually enter different realms.

#### Layer 2: Stochastic Starting Grammar

When starting a new save, you don't get the full grammar. You get a random subset:

```
Player A's starting kit:
  Elements: Fire, Frost
  Forms: Projectile, Nova
  Modifiers: Pierce, Split

Player B's starting kit (same day one):
  Elements: Lightning, Blood
  Forms: Beam, Aura
  Modifiers: Chain, Linger
```

There is no universal meta because the meta depends on which atoms you were dealt. Mimics the isekai feel — every MC is summoned with a unique configuration.

#### Layer 3: Path-Dependent Devour

Two players, same realm, same seed, same starting kit. Player A walks north, meets a Frost Wolf, devours Frost. Player B walks south, meets a Fire Slime, devours Fire. Their builds diverge based on encounter order. Exploration = divergence.

#### Layer 4: Adaptive Realm

The realm watches what you're doing and pushes back:

- 80% Fire usage → spawns Cinder Wraiths (absorb Fire, reflect 50%).
- Melee-only → spawns Phase Stalkers (teleport away from melee).
- Single-skill spam → spawns Echo Hunters (copy your most-used skill back at you).

The moment a meta emerges, the realm hard-counters it. Players maintain diverse builds by necessity.

#### Layer 5: Player-Authored Grimoire

Saved skills are named and personalized. Skills can be shared as codes (like PoE build codes, but for individual spells). The meta becomes a conversation, not a dictate.

### Why This Works in Co-op

| Concern | Solution |
|---|---|
| "Won't co-op players run the same build?" | Each player brings their personal grammar to the party. Different tools, same fight. |
| "Won't the host dominate?" | Devour rewards the killer, not the host. Players naturally specialize by competing for essence. |
| "Won't metas spread through chat?" | Adaptive realm counters whatever's currently dominant. |
| "Won't sync be a nightmare?" | Game Core is pure TypeScript, server-authoritative, shareable between client and server. |

The secret to good co-op isn't "everyone has the same experience." It's "everyone has a different experience that fits together."

---

## 6. Game Structure — Three Layers

### Layer 1: The Sanctum (Hub)

- Small isekai home base between runs (Rimuru's village vibes).
- Skill synthesis UI, grimoire management, Sage dialogue, realm selection.
- Light NPC interactions, short dialogue.
- Always shows your next objective — this is the "semi-sandbox with guidance" anchor.

### Layer 2: Realms (Roguelite)

- Procedurally generated per run.
- Biome + layout + enemy types + boss + realm modifiers.
- Goal: defeat the realm boss to absorb its essence and progress.
- Death = return to Sanctum, lose realm progress, keep discovered skills + essence.
- Each realm clear unlocks new grammar atoms.

**First realm: Verdant Rift** — corrupted forest, slimes/wolves/goblin-likes, Treant Boss. Tutorial-friendly. Introduces Frost/Fire/Nature elements.

### Layer 3: Match Mode (AoV-Inspired)

- Self-contained 10–20 minute matches.
- Two lanes, minion waves, structures, boss monster.
- Solo vs AI (day one), co-op vs AI (later).
- Ranked-style progression, daily challenges.
- The "I have 15 minutes, let's fight" mode.

The three layers feed each other: realms unlock atoms → atoms usable in matches → matches reward essence → essence used in realms.

---

## 7. Narrative Approach

**Light but resonant.** No Genshin-scale cutscenes.

- No long cutscenes — max 30 seconds between realms.
- **Voice of the World**: concise system messages. The guidance system, diegetically. e.g., `「Skill acquired: Frost Echo」`, `「Analysis complete. New modifier unlocked: Pierce.」`
- **Inner Sage** (Raphael equivalent): short reactive dialogue in combat. e.g., `「Foe analyzed. Weak to Frost.」`
- **Lore via items**: skill descriptions, essence descriptions, realm names hint at story.
- **Prologue**: 2–3 minute isekai summoning → tutorial naturally → first realm.

### The Isekai Framing (Diegetic Justification)

The "summoning" explains why YOU grow without limit — the world is feeding you. Your `[Devour]` skill is unique; no one else has it. You are the anomaly. The world is broken; you are how it gets fixed (or destroyed).

---

## 8. Visual & Audio Direction

### Visual Style: Anime, Isometric

- **Perspective**: Isometric (like AoV / Dota 2), not strict top-down.
- **Characters**: 2D sprites with 8-directional animation (idle, walk, cast, hit, death).
- **VFX**: Procedural particle effects generated from skill grammar. Each skill looks unique because it IS unique.
- **Environment**: Isometric tile-based, painted backgrounds for set pieces.
- **UI**: Anime-styled panels. Clean, minimal, functional.

### Asset Strategy (No AI Art, No Commissions for MVP)

- Free anime sprite packs (itch.io, OpenGameArt), filtered for style consistency.
- Small palette of base sprites + heavy procedural VFX differentiation.
- Long-term: commissioned assets once the game is playable end-to-end.

### Audio

- **Howler.js** for spatial audio.
- Procedural audio synthesis for skill casts (each element+form has a base sound, modifiers layer additional tones).
- Atmospheric ambient tracks per biome.

---

## 9. Tech Stack

```
┌─────────────────────────────────────────────┐
│  CLIENT (Desktop-first, mobile-ready)        │
│  Vite + TypeScript                            │
│  PixiJS (2D WebGL renderer, isometric)        │
│  bitECS (Entity Component System)             │
│  Zustand (UI state)                            │
│  Howler.js (audio)                             │
├─────────────────────────────────────────────┤
│  GAME CORE (engine-agnostic, server-shareable)│
│  Pure TypeScript — no rendering dependencies  │
│  - ECS world + systems                        │
│  - Skill grammar engine                       │
│  - Combat math, AI, simulation                │
│  - All state is plain serializable objects    │
├─────────────────────────────────────────────┤
│  NETWORK LAYER (future co-op)                 │
│  Abstraction: GameClient interface            │
│   ├─ LocalSoloClient (default, day 1)         │
│   └─ NetworkClient (later, WebSocket)         │
│  Server (later): Colyseus on Node.js          │
└─────────────────────────────────────────────┘
```

### Why This Stack

| Need | Answer |
|---|---|
| AI assistant can run & test code | Browser runs in same environment as code; dev server reloads in milliseconds |
| Hot reload | Vite gives sub-second reloads on every save |
| No install friction | Open a URL, you're playing |
| Shareable | Send a link, friend is testing |
| Cross-platform | Works on phone, tablet, desktop |
| 2D/2.5D MOBA-style graphics | PixiJS — best-in-class 2D WebGL |
| Future co-op without rewrites | Pure-TS Game Core + GameClient abstraction |

### Why Not Unity/Unreal/Godot

- Harder for AI assistant to run/test/debug iteratively.
- Install friction, build times, platform constraints.
- Web tech lets us iterate in seconds, not minutes.

---

## 10. Architecture

### 10.1 The Golden Rule

**Game Core is pure TypeScript. Zero rendering. Zero networking. Zero DOM.**

Game Core contains: ECS world, skill grammar, combat math, AI, simulation, all state as plain serializable objects. It runs identically in browser, in Node, on a server.

This means:
- **Day 1 (solo)**: Game Core runs locally, PixiJS renders, LocalSoloClient drives input.
- **Future (co-op)**: Same Game Core runs on Colyseus server, PixiJS still renders, NetworkClient sends inputs and receives snapshots.
- We never rewrite game logic when adding multiplayer.

### 10.2 ECS (Entity Component System)

We use **bitECS** for the simulation layer. Entities are IDs. Components are data. Systems are functions that mutate components. This lets us add new mechanics (new systems) without rewriting existing ones.

### 10.3 Project Layout

```
soulforge/
├── README.md                  # This document
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── assets/                # Sprites, audio, etc.
└── src/
    ├── main.ts                # Entry point — bootstraps client
    ├── client/
    │   ├── GameApp.ts         # PixiJS application, main loop
    │   ├── render/            # Render systems (ECS → PixiJS)
    │   ├── input/             # Input handling
    │   ├── ui/                # HUD, menus (Zustand + DOM)
    │   └── audio/             # Howler.js wrappers
    ├── core/                  # GAME CORE (pure TS, no deps on client/)
    │   ├── ecs/               # ECS world, components, systems
    │   ├── grammar/           # Skill grammar engine
    │   ├── combat/            # Damage math, hit detection
    │   ├── ai/                # Enemy AI
    │   ├── realm/             # Procedural realm generation
    │   ├── devour/            # Devour, analysis, synthesis
    │   ├── state/             # Serialized game state
    │   └── seed/              # PRNG, essence salt, seed composition
    ├── data/                  # JSON data: atoms, enemies, biomes
    │   ├── elements.json
    │   ├── forms.json
    │   ├── vectors.json
    │   ├── modifiers.json
    │   ├── enemies.json
    │   └── biomes.json
    ├── net/                   # Network abstraction
    │   ├── GameClient.ts      # Interface
    │   ├── LocalSoloClient.ts # Day 1 implementation
    │   └── NetworkClient.ts   # Future
    └── types/                 # Shared TS types
```

### 10.4 Game Loop

```
Each frame:
  1. Input system reads keyboard/mouse → writes to InputComponent
  2. GameClient (local or network) produces authoritative input state
  3. Simulation systems run in fixed timestep:
     a. Movement system
     b. Combat system
     c. AI system
     d. Devour system
     e. Realm system
  4. Render systems read ECS state → update PixiJS display objects
  5. UI systems (Zustand) read ECS state → update DOM
  6. Audio system fires one-shots based on event queue
```

---

## 11. Roadmap

| Phase | Goal | Deliverable |
|---|---|---|
| **0. Foundation** | Vite + TS + PixiJS + ECS + isometric tilemap + character movement | Character walks on isometric map, camera follows |
| **1. Combat Core** | Basic attack, hit detection, enemy AI, health, death | Can kill a dummy enemy |
| **2. Skill Grammar v1** | 5 elements × 3 forms × 5 modifiers → 75 emergent skills | Craft + cast + see procedural VFX |
| **3. Devour System** | Essence shards, analysis, skill library | Rimuru's core loop works |
| **4. First Realm (Roguelite)** | Procedural layout, minions, structures, boss | Full realm clear, ~10 min |
| **5. Sanctum Hub** | Skill synthesis UI, library, next-realm picker | Guided progression |
| **6. Narrative Layer** | Prologue, Voice of the World, Sage voice | Isekai feel achieved |
| **7. Match Mode** | AoV-style self-contained battle | Quick-play option |
| **8. Mobile Controls** | Touch joystick + skill buttons | Phone-playable |
| **9. Co-op Groundwork → Co-op** | Network layer + Colyseus | Multiplayer realms |

---

## 12. Phase 0 Scope

**Goal**: A character walks around an isometric map. Camera follows. WASD + click-to-move both work. Debug HUD shows FPS, position, and current "realm" name. This proves the foundation is solid before we build mechanics on top.

### Phase 0 Acceptance Criteria

- [ ] Vite dev server starts without errors.
- [ ] PixiJS canvas renders in browser.
- [ ] Isometric tilemap displays (at least 20×20 tiles, two tile types for contrast).
- [ ] Character sprite renders on the map.
- [ ] WASD moves the character in isometric directions.
- [ ] Click-to-move routes the character toward the clicked tile.
- [ ] Camera follows the character smoothly.
- [ ] Debug HUD shows FPS, character tile coordinates, and "Realm: Verdant Rift (Prototype)".
- [ ] Frame rate stable at 60 FPS in Chrome.
- [ ] Code structure follows Section 10.3 (clear client/core split, even if core is minimal).

### Phase 0 Non-Goals

- No combat, no enemies, no skills.
- No procedural generation yet (the map is hand-laid for now).
- No audio.
- No save/load.
- No mobile controls.

---

## 13. Development

### Prerequisites

- Node.js 18+ and npm
- A modern browser (Chrome recommended)

### Setup

```bash
cd /home/z/my-project
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run `tsc --noEmit` only |

### Iteration Discipline

- **Script Persistence Rule**: Any non-trivial generation script lives in `/home/z/my-project/scripts/` and is edited in place, not regenerated.
- **Worklog**: Multi-agent work log at `/home/z/my-project/worklog.md`. Append-only.
- **Downloads**: Final user-facing deliverables go in `/home/z/my-project/download/`. The game itself runs from the dev server.

---

## 14. Glossary

| Term | Definition |
|---|---|
| **Atom** | A single grammar element (e.g., the Fire element, or the Pierce modifier). |
| **Essence Shard** | Drops from defeated enemies. Devoured to trigger Analysis. |
| **Analysis** | The process of revealing an enemy's skill grammar fragments after devouring its essence. |
| **Skill Library** | The player's collected catalog of analyzed/known skills. |
| **Grimoire** | The player's personal named & saved skills. Shareable via codes. |
| **Magicule** | The mana/aura resource. Grows with devour history. |
| **Mimicry Form** | A creature form the player can shift into after devouring it. |
| **Voice of the World** | Diegetic system message channel. Concise guidance. |
| **Inner Sage** | The MC's analyst companion (Raphael equivalent). Reactive combat dialogue. |
| **Essence Salt** | A per-player seed modifier derived from play history. Causes realm personalization. |
| **Sanctum** | The hub between runs. |
| **Realm** | A roguelite combat zone with a boss. |
| **Match** | A self-contained AoV-style battle. |
| **Grammar** | The compositional rule set that generates skills from atoms. |

---

## 15. Design Constitution

Non-negotiable principles. If a proposed feature violates any of these, it is rejected.

1. **Skills are data, not code.** A skill is a JSON object describing its grammar composition. The engine interprets it.
2. **Atoms are finite, compositions are infinite.** We add atoms over time; we never hardcode skills.
3. **Player expression > balance.** This is power fantasy, not esports. Overpowered is the goal.
4. **Every system is debuggable in the browser.** No black boxes.
5. **Vertical slices over horizontal sprawl.** Build ONE realm fully playable before adding more.
6. **Isekai framing is diegetic.** The "summoning" explains why YOU grow without limit — the world is feeding you.
7. **Game Core is pure TypeScript.** Zero rendering. Zero networking. Zero DOM. Shareable between client and server.
8. **Guidance is diegetic.** Voice of the World and Inner Sage provide direction in-fiction, not through UI hand-holding.
9. **Divergence is mechanical, not narrative.** Players walk different paths because the systems force it, not because of branching story.
10. **No runtime AI.** All "infinite" content comes from compositional grammar, not from LLM calls.

---

## 16. Change Log

| Date | Change |
|---|---|
| 2026-06-27 | Initial README created. Full design documented. |
| 2026-06-27 | **Phase 0 (Foundation) COMPLETE.** Vite + TS + PixiJS + bitECS project boots, isometric tilemap renders, player spawns and moves (WASD + click-to-move), camera follows smoothly, debug HUD shows FPS/coords/realm. Production build succeeds. Ready for Phase 1 (Combat Core). |
| 2026-06-27 | **Phase 1 (Combat Core) COMPLETE.** Player + 5 enemies spawn in Verdant Rift. Mana Bolt (right-click) fires homing projectiles with cooldown. Enemies have idle → chase → attack AI with leash. Health bars above entities, floating damage numbers, essence shard drops on death. Player can die and respawn with R. HUD shows HP, cooldown, enemy count. Production build succeeds (95KB gzipped). Ready for Phase 2 (Skill Grammar). |
| 2026-06-27 | **Phase 2 (Skill Grammar v1) COMPLETE.** Compositional skill grammar implemented: 5 elements × 3 forms × 3 vectors × 5 modifiers = 2,310 unique skills possible. Player has 3 starter skills (Mana Bolt, Frost Nova, Lightning Beam) bound to slots 1-3. Right-click casts slot 1, keys 1-4 cast any slot toward mouse. Each element has its own color (Force=gray, Fire=orange, Frost=cyan, Lightning=yellow, Void=purple) and status effect (burn/slow/shock/drain). Beam renders as fading line VFX, Nova renders as expanding ring VFX, Projectile color comes from element. HUD shows all 4 skill slots with names + cooldown bars. Status effects tick (burn damages, drain heals caster). Ready for Phase 3 (Devour System). |
| 2026-06-27 | **Phase 2.5 (Modifier Implementation) COMPLETE.** All 5 modifiers now functional: Pierce (already worked), Split (spawns 2 children on kill), Linger (leaves damaging area), Chain (bounces to nearest enemy, 3 hops), Grow (scales damage/radius with travel distance). Also fixed: beam lifetime bug (beams stayed forever because no system decremented Lifetime for non-projectiles), nova multi-hit bug (same enemy hit multiple times per frame), Frost Nova slow was a no-op (now wired into enemy AI speed). |
| 2026-06-27 | **Phase 3 (Devour System) COMPLETE.** Rimuru's signature power implemented. Kill enemy → essence shard drops with enemy type → walk near (50px) → auto-devour → roll for atom unlocks → Voice of the World notification. 3 enemy types (Frost Slime, Ember Wisp, Storm Sprite) each drop different elements + modifiers. Active [Devour] skill on E key: AOE devour + execute weak enemies (HP<25%), 8s cooldown. DevourProgress tracks unlocked atoms as bitmasks (start with Force/Projectile/Ranged). HUD shows Devour cooldown, devour count, and unlocked atoms. Voice of the World notifications appear centered at top of screen. Verified: killed Frost Slime → devoured essence → Frost element unlocked → notification displayed. |
| 2026-06-27 | **Phase 4 (Roguelite Realms) COMPLETE.** Procedural realm generation replaces hand-laid prototype. 3 biomes (forest/cave/void) chosen by depth, each with unique tile colors, enemy pools, and bosses. Realms seeded by composeRealmSeed (seed + player essence salt + run number) — same seed = same realm, different players = different realms. Death loop: die → depth++ → new harder realm → DevourProgress persists. 3 new enemy types (Treant Boss, Void Shade, Void Titan). Death callback saves DevourProgress before player entity is removed. Verified: killed enemy → devoured → died → pressed R → new realm at depth 2 with 6 enemies → unlocked atoms (Force/Fire/Frost) carried over. |
| 2026-06-27 | **Phase 5 (Sanctum Hub) COMPLETE.** DOM-based overlay hub between realms. Craft new skills from unlocked atoms (Element + Form + Vector + up to 3 Modifiers) with live stat preview. Synthesize two skills into a new one (Element from A, Form from B, merged modifiers). Grimoire lists all owned skills with stats. Equip section assigns skills to 4 slots. Descend button generates new realm with equipped skills. Owned skills + equipped indices persist across death in RunState. Fixed ElementId 0 (Force) falsy bug — JS `!0` is true, so craft preview was broken when Force was selected. Verified: crafted 'Test Bolt' (Force+Projectile+Ranged), grimoire count 8→9, skill persisted in RunState. |
| 2026-06-27 | **Phase 6 (Narrative Layer) COMPLETE.** Isekai framing added. 11-beat prologue sequence plays on first load (death → summoning → [Devour] acquisition → Inner Sage introduction → awakening). PrologueUI is a cinematic overlay with fading text + background color shifts. Inner Sage dialogue in Sanctum (purple avatar, state-aware lines: first visit, returning, low atoms, many atoms). Death quotes randomly shown in Sanctum. Realm intros + Sage comments logged on realm entry. All narrative text centralized in src/data/narrative.ts for easy editing. Verified: prologue shows "You were nobody special." → click through → game starts → die → Sanctum shows Sage dialogue + death quote. |
| 2026-06-27 | **Phase 6.5 (UX Polish) COMPLETE.** Game-style HUD replaces dashboard panel (bottom skill bar, slim health bar, compact devour button, F3 debug toggle, death screen). Sanctum redesigned with progressive disclosure (4 action buttons → focused sub-panels). Sanctum game-ified with animated particle background. Realm sizes doubled (48-56 tiles). Text selection fixed (global user-select: none). Prologue supports Space/Enter/click. Voluntary Sanctum access (R key anytime). Realm clear detection (all enemies dead → "Realm Cleared! Press R to descend"). |
| 2026-06-27 | **Phase 7 (Match Mode) COMPLETE.** AoV-inspired quick-play mode. Mode select screen after prologue (Realm vs Match). 32×32 arena with 2 lanes, vertical connector, 6 structures (2 towers + 1 core per side). Minion waves spawn every 30s (melee + ranged per lane, both teams). Minion AI: walk lane waypoints, attack nearest enemy (minions + structures). Structure AI: towers + cores attack nearby enemy minions. Win: destroy enemy core. Lose: player core destroyed. Skills + devour progress carry over from realm mode. VLM confirmed: minions visible moving on paths, structures with health bars. |

---

*SoulForge — forge your soul, devour the world.*
