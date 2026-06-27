/**
 * GameApp — the PixiJS application and main loop.
 *
 * Phase 4: Roguelite realm generation + death loop.
 *   - Realms are procedurally generated from a seed (composeRealmSeed)
 *   - Biome chosen by depth (forest → cave → void)
 *   - Boss spawned in arena at center-bottom
 *   - On death: depth++, new realm generated, DevourProgress preserved
 *   - R key now triggers "next realm" instead of same-realm respawn
 *
 * Main loop order (each frame):
 *   1. Read input → ECS (movement + skill casts + Devour)
 *   2. Step simulation systems
 *   3. Update camera
 *   4. Sync renderers
 *   5. Update HUD
 *   6. Check for death → trigger realm transition
 */

import { Application, Container } from "pixi.js";
import { IsoTilemap } from "./render/IsoTilemap";
import { EntityRenderer } from "./render/EntityRenderer";
import { CameraController } from "./render/CameraController";
import { InputManager } from "./input/InputManager";
import { HUD } from "./ui/HUD";
import { movementSystem } from "@core/ecs/systems/movementSystem";
import {
  cooldownSystem,
  facingSystem,
  projectileSystem,
  collisionSystem,
  enemyAISystem,
  damageNumberSystem,
  lifetimeSystem,
  cleanupDeadEntities,
  spawnEnemy,
  clearAllEntities,
  lingeringAreaSystem,
  growModifierSystem,
  setPlayerDeathCallback,
} from "@core/ecs/systems/combatSystems";
import {
  castSkillSystem,
  novaSystem,
  beamSystem,
  statusEffectSystem,
  skillCooldownSystem,
  spawnPlayerWithSkills,
} from "@core/ecs/systems/skillSystems";
import {
  autoDevourSystem,
  devourSkillSystem,
  voiceOfTheWorldSystem,
  addDevourProgressToPlayer,
  setEnemyType,
  getDevourProgressSummary,
  spawnVoiceOfTheWorld,
} from "@core/ecs/systems/devourSystems";
import { tileToWorld } from "@core/iso";
import { getBiomeForDepth } from "@data/biomes";
import { generateRealm, computeEssenceSalt, type GeneratedRealm } from "@core/realm/generator";
import {
  createNewRunState,
  advanceRunOnDeath,
  type RunState,
} from "@core/realm/runState";
import { defineQuery, hasComponent } from "bitecs";
import { world, PlayerTag, Health, DevourProgress, EnemyAI } from "@core/ecs/world";
import { SanctumUI } from "./ui/SanctumUI";
import { playerSkills, rebuildSkillStatsCache } from "@core/ecs/systems/skillSystems";

const playerDeathCheckQuery = defineQuery([PlayerTag, Health]);

export class GameApp {
  private app: Application;
  private worldContainer!: Container;
  private tilemap!: IsoTilemap;
  private entityRenderer!: EntityRenderer;
  private camera!: CameraController;
  private input!: InputManager;
  private hud!: HUD;

  private lastTime = 0;
  private running = false;
  private rKeyHeld = false;

  // Phase 4: Roguelite state
  private runState: RunState;
  private currentRealm: GeneratedRealm | null = null;
  private bossEid: number = -1;
  private realmTransitioning = false;

  // Phase 5: Sanctum UI
  private sanctumUI!: SanctumUI;

  constructor() {
    this.app = new Application();
    this.runState = createNewRunState();
  }

  async init() {
    await this.app.init({
      resizeTo: window,
      background: 0x0a0a0f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    const canvas = this.app.canvas;
    canvas.id = "soulforge-canvas";
    document.getElementById("app")!.appendChild(canvas);

    // World container holds everything that lives in game space.
    this.worldContainer = new Container();
    this.worldContainer.label = "World";
    this.app.stage.addChild(this.worldContainer);

    // Entity renderer (created before tilemap so entities render on top)
    this.entityRenderer = new EntityRenderer();
    this.worldContainer.addChild(this.entityRenderer.container);

    // Phase 5: Sync owned skills to the registry before generating the first realm
    this.syncOwnedSkillsToRegistry();

    // Generate the first realm
    this.generateAndLoadRealm();

    // Camera
    this.camera = new CameraController(
      this.worldContainer,
      this.app.screen.width,
      this.app.screen.height
    );

    // Input
    this.input = new InputManager((sx, sy) => this.camera.screenToWorld(sx, sy));

    // Click handling on the canvas — left = move, right = cast slot 0
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.button === 2) {
        this.input.onCanvasRightClick(sx, sy);
      } else if (e.button === 0) {
        this.input.onCanvasLeftClick(sx, sy);
      }
    });

    // HUD
    this.hud = new HUD(this.currentRealm?.name ?? "Unknown");
    this.hud.hideLoading();

    // Phase 5: Initialize Sanctum UI
    this.sanctumUI = new SanctumUI(this.runState, () => this.descendFromSanctum());

    // Handle window resize
    window.addEventListener("resize", () => {
      this.camera.resize(this.app.screen.width, this.app.screen.height);
    });

    // Enable sortable children for depth ordering
    this.worldContainer.sortableChildren = true;

    // Phase 4: Register the player death callback to save DevourProgress
    // BEFORE the player entity is removed by cleanupDeadEntities.
    setPlayerDeathCallback((pid: number) => {
      if (hasComponent(world, DevourProgress, pid)) {
        this.runState.devourProgress = {
          unlockedElements: DevourProgress.unlockedElements[pid],
          unlockedForms: DevourProgress.unlockedForms[pid],
          unlockedVectors: DevourProgress.unlockedVectors[pid],
          unlockedModifiers: DevourProgress.unlockedModifiers[pid],
          totalDevoured: DevourProgress.totalDevoured[pid],
        };
        console.log(
          `%c[Death] %cDevourProgress saved: ${this.runState.devourProgress.totalDevoured} devoured, elements=0b${this.runState.devourProgress.unlockedElements.toString(2)}`,
          "color: #ff4040; font-weight: bold;",
          "color: #e0e0e8;"
        );
      }
    });

    console.log(
      `%c[SoulForge] %cEntered ${this.currentRealm?.name} (Depth ${this.runState.depth})`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );
  }

  /**
   * Generate a new realm from the run state and load it.
   * Called on init and on death.
   */
  private generateAndLoadRealm() {
    // Clear any existing entities
    clearAllEntities();

    // Compute essence salt from the player's persistent devour progress
    const dp = this.runState.devourProgress;
    const essenceSalt = computeEssenceSalt(
      dp.totalDevoured,
      dp.unlockedElements,
      dp.unlockedForms,
      dp.unlockedVectors,
      dp.unlockedModifiers
    );

    // Generate the realm
    this.currentRealm = generateRealm(
      this.runState.baseSeed,
      essenceSalt,
      this.runState.runNumber,
      this.runState.depth
    );

    // Recreate the tilemap if it exists, otherwise create it
    if (this.tilemap) {
      this.worldContainer.removeChild(this.tilemap.container);
      this.tilemap.container.destroy();
    }
    this.tilemap = new IsoTilemap(this.currentRealm);
    // Insert tilemap BEFORE the entity renderer so entities render on top
    this.worldContainer.addChildAt(this.tilemap.container, 0);

    // Spawn entities
    this.spawnRealmEntities();

    // Spawn the "enter realm" notification
    const biome = getBiomeForDepth(this.runState.depth);
    spawnVoiceOfTheWorld(7, 2); // "Entering {biome}..."
    console.log(`%c${biome.enterFlavor}`, "color: #8888a0; font-style: italic;");
  }

  /**
   * Spawn the player at the realm start + all enemies + boss.
   */
  private spawnRealmEntities() {
    if (!this.currentRealm) return;
    const realm = this.currentRealm;
    const biome = getBiomeForDepth(this.runState.depth);

    const start = realm.playerStart;
    const startWorld = tileToWorld(start.col, start.row);
    const pid = spawnPlayerWithSkills(
      startWorld.x,
      startWorld.y,
      this.runState.equippedSkillIndices
    );

    // Restore DevourProgress from run state (persists across deaths)
    addDevourProgressToPlayer(pid);
    if (hasComponent(world, DevourProgress, pid)) {
      DevourProgress.unlockedElements[pid] = this.runState.devourProgress.unlockedElements;
      DevourProgress.unlockedForms[pid] = this.runState.devourProgress.unlockedForms;
      DevourProgress.unlockedVectors[pid] = this.runState.devourProgress.unlockedVectors;
      DevourProgress.unlockedModifiers[pid] = this.runState.devourProgress.unlockedModifiers;
      DevourProgress.totalDevoured[pid] = this.runState.devourProgress.totalDevoured;
    }

    // Spawn enemies with biome-appropriate types
    const enemyTypeIds = biome.enemyTypeIds;
    const statMult = biome.enemyStatMultiplier;
    for (let i = 0; i < realm.enemySpawns.length; i++) {
      const spawn = realm.enemySpawns[i];
      const w = tileToWorld(spawn.col, spawn.row);
      const eid = spawnEnemy(w.x, w.y);
      // Assign enemy type from biome's pool (cycled)
      const typeId = enemyTypeIds[i % enemyTypeIds.length];
      setEnemyType(eid, typeId);

      // Apply biome stat multiplier
      if (hasComponent(world, Health, eid)) {
        Health.max[eid] *= statMult;
        Health.current[eid] = Health.max[eid];
      }
    }

    // Spawn the boss in the arena
    const bossWorld = tileToWorld(realm.bossSpawn.col, realm.bossSpawn.row);
    this.bossEid = spawnEnemy(bossWorld.x, bossWorld.y);
    setEnemyType(this.bossEid, realm.bossTypeId);
    // Boss gets extra stat multiplier
    if (hasComponent(world, Health, this.bossEid)) {
      Health.max[this.bossEid] *= statMult * 1.5;
      Health.current[this.bossEid] = Health.max[this.bossEid];
    }
    // Make boss bigger (radius)
    if (hasComponent(world, EnemyAI, this.bossEid)) {
      // Boss is tagged via the enemy type — the renderer will color it
    }

    console.log(
      `%c[Realm] %c${realm.name} — Depth ${realm.depth} — ${realm.enemySpawns.length} enemies + 1 boss`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );
  }

  /**
   * Phase 4: Roguelite death loop.
   * Called when the player dies.
   * Saves DevourProgress, advances run state, generates new realm.
   */
  private onPlayerDeath() {
    // DevourProgress is already saved by the death callback registered in init().

    // Advance the run state (depth++, runNumber++, mode → sanctum)
    const oldDepth = this.runState.depth;
    this.runState = advanceRunOnDeath(this.runState);

    console.log(
      `%c[Death] %cYou died on depth ${oldDepth}. Entering Sanctum...`,
      "color: #ff4040; font-weight: bold;",
      "color: #e0e0e8;"
    );

    // Phase 5: Show the Sanctum instead of immediately generating a new realm.
    // The player crafts/synthesizes/equips skills, then clicks "Descend".
    this.sanctumUI.updateRunState(this.runState);
    this.sanctumUI.show();
  }

  /**
   * Phase 5: Called when the player clicks "Descend" in the Sanctum.
   * Generates a new realm and restores the player's equipped skills.
   */
  private descendFromSanctum() {
    console.log(
      `%c[Sanctum] %cDescending to depth ${this.runState.depth}...`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );

    // Sync the player's owned skills to the skillSystems registry
    this.syncOwnedSkillsToRegistry();

    // Generate and load the new realm
    this.generateAndLoadRealm();

    // Update HUD with new realm name
    if (this.hud && this.currentRealm) {
      this.hud.setRealmName(this.currentRealm.name);
    }
  }

  /**
   * Phase 5: Sync the RunState's ownedSkills to the skillSystems playerSkills array.
   * Also updates the stats cache. Called before spawning the player so that
   * spawnPlayerWithSkills can read the correct skill indices.
   */
  private syncOwnedSkillsToRegistry() {
    // Replace the playerSkills array contents with the run state's owned skills
    playerSkills.length = 0; // clear
    for (const skill of this.runState.ownedSkills) {
      playerSkills.push(skill);
    }
    // Rebuild the stats cache
    // (getSkillStats reads from playerSkillStatsCache which is built at module load)
    // We need to rebuild it — but it's a const array. Let me use a different approach:
    // spawnPlayerWithSkills reads from playerSkillStatsCache, which was built from STARTER_SKILLS.
    // For Phase 5, we need to make the stats cache dynamic.
    // For now, let's rebuild it by re-importing computeSkillStats for each skill.
    // The skillSystems module exports getSkillStats which reads the cache.
    // We'll update the cache directly.
    this.rebuildSkillStatsCache();
  }

  /**
   * Rebuild the skill stats cache from the current playerSkills array.
   */
  private rebuildSkillStatsCache() {
    rebuildSkillStatsCache();
  }

  /**
   * R key now triggers realm transition (death or next realm).
   * If player is alive, R does nothing (prevents accidental skips).
   * If player is dead, R descends to the next realm.
   */
  private handleRKey() {
    if (!this.input.isRPressed() || this.rKeyHeld) return;
    this.rKeyHeld = true;

    // Check if player is dead
    const players = playerDeathCheckQuery(world);
    if (players.length === 0) {
      // Player is dead — trigger death loop (shows Sanctum)
      this.onPlayerDeath();
    }
    // If player is alive, R does nothing (prevents accidental realm skips)
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.app.ticker.add(this.tick);
  }

  private tick = () => {
    if (!this.running) return;

    // Phase 5: Pause simulation while the Sanctum is open
    if (this.sanctumUI && this.sanctumUI.isVisible()) {
      this.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    // ── Step 1: input → ECS ────────────────────────────────────────────
    this.input.update();

    // R key — triggers death loop if player is dead
    this.handleRKey();
    if (!this.input.isRPressed()) {
      this.rKeyHeld = false;
    }

    // Read & process all pending skill cast requests (slots 0..3)
    const casts = this.input.consumeCastRequests();
    for (let i = 0; i < casts.length; i++) {
      const c = casts[i];
      if (c.active) {
        castSkillSystem(dt, { slot: c.slot, targetX: c.targetX, targetY: c.targetY, active: true });
      }
    }
    this.input.clearCastRequests();

    // Phase 3: Devour skill (E key)
    const devourRequested = this.input.consumeDevourRequest();
    if (devourRequested) {
      devourSkillSystem(dt, { active: true });
    }

    // ── Step 2: simulation systems in dependency order ────────────────
    skillCooldownSystem(dt);
    cooldownSystem(dt);
    facingSystem(dt);
    projectileSystem(dt);
    novaSystem(dt);
    beamSystem(dt);
    collisionSystem();
    enemyAISystem(dt);
    movementSystem(dt);
    damageNumberSystem(dt);
    statusEffectSystem(dt);
    lingeringAreaSystem(dt);
    growModifierSystem(dt);
    autoDevourSystem();
    voiceOfTheWorldSystem(dt);
    cleanupDeadEntities();
    lifetimeSystem(dt);

    // ── Step 3: Check for player death ─────────────────────────────────
    if (!this.realmTransitioning) {
      const players = playerDeathCheckQuery(world);
      if (players.length === 0) {
        // Player is dead — show death message, wait for R key
        // (handled in handleRKey)
      }
    }

    // ── Step 4: camera → world container ───────────────────────────────
    this.camera.update(dt);

    // ── Step 5: sync renderers ─────────────────────────────────────────
    this.entityRenderer.sync();

    // ── Step 6: HUD ────────────────────────────────────────────────────
    this.hud.update(dt);
    // Update HUD with run state info
    this.hud.updateRunState(this.runState.depth, this.runState.devourProgress.totalDevoured);
  };

  destroy() {
    this.running = false;
    this.app.ticker.remove(this.tick);
    this.input.dispose();
    this.app.destroy(true);
  }
}

// Suppress unused import warnings — these are used in type annotations only
void getDevourProgressSummary;
