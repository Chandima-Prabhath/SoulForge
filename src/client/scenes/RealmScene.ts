/**
 * RealmScene — roguelite realm mode using the scene system.
 *
 * Ports the existing realm logic (procedural generation, devour, sanctum access,
 * death loop, realm clear) into the GameScene base class.
 */

import { Application, Container } from "pixi.js";
import { GameScene } from "./GameScene";
import { defineQuery, hasComponent } from "bitecs";
import {
  world,
  PlayerTag,
  Health,
  DevourProgress,
  EnemyAI,
} from "@core/ecs/world";
import {
  spawnPlayerWithSkills,
  rebuildSkillStatsCache,
  playerSkills,
} from "@core/ecs/systems/skillSystems";
import { addDevourProgressToPlayer, setEnemyType, spawnVoiceOfTheWorld } from "@core/ecs/systems/devourSystems";
import { spawnEnemy, clearAllEntities, setPlayerDeathCallback } from "@core/ecs/systems/combatSystems";
import { tileToWorld } from "@core/iso";
import { getBiomeForDepth } from "@data/biomes";
import { generateRealm, computeEssenceSalt } from "@core/realm/generator";
import {
  advanceRunOnDeath,
  type RunState,
} from "@core/realm/runState";
import { SanctumUI } from "../ui/SanctumUI";
import { REALM_INTROS } from "@data/narrative";
import type { GeneratedRealm } from "@core/realm/generator";

const playerDeathCheckQuery = defineQuery([PlayerTag, Health]);
const enemyQuery = defineQuery([EnemyAI, Health]);

export class RealmScene extends GameScene {
  private runState: RunState;
  private sanctumUI: SanctumUI;
  private currentRealm: GeneratedRealm | null = null;
  private realmCleared = false;

  constructor(
    app: Application,
    worldContainer: Container,
    runState: RunState,
    sanctumUI: SanctumUI,
    onReturnToMenu: () => void
  ) {
    super(app, worldContainer);
    this.runState = runState;
    this.sanctumUI = sanctumUI;
    void onReturnToMenu;

    // Register death callback
    setPlayerDeathCallback((pid: number) => {
      if (hasComponent(world, DevourProgress, pid)) {
        this.runState.devourProgress = {
          unlockedElements: DevourProgress.unlockedElements[pid],
          unlockedForms: DevourProgress.unlockedForms[pid],
          unlockedVectors: DevourProgress.unlockedVectors[pid],
          unlockedModifiers: DevourProgress.unlockedModifiers[pid],
          totalDevoured: DevourProgress.totalDevoured[pid],
        };
      }
    });
  }

  onEnter() {
    this.syncOwnedSkills();
    this.generateAndLoadRealm();
    this.setupCameraZoom(1.0);
    this.showHud();

    const canvas = this.app.canvas;
    canvas.id = "soulforge-canvas";
    this.setupInput(canvas);

    console.log(
      `%c[SoulForge] %cEntered ${this.currentRealm?.name} (Depth ${this.runState.depth})`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );
  }

  onExit() {
    clearAllEntities();
    this.hideHud();
  }

  protected handleRKey() {
    if (!this.input.isRPressed() || this.rKeyHeld) return;
    this.rKeyHeld = true;

    const players = playerDeathCheckQuery(world);
    if (players.length === 0) {
      // Player is dead — trigger death flow
      this.onPlayerDeath();
    } else {
      // Player is alive — open Sanctum voluntarily
      const pid = players[0];
      if (hasComponent(world, DevourProgress, pid)) {
        this.runState.devourProgress = {
          unlockedElements: DevourProgress.unlockedElements[pid],
          unlockedForms: DevourProgress.unlockedForms[pid],
          unlockedVectors: DevourProgress.unlockedVectors[pid],
          unlockedModifiers: DevourProgress.unlockedModifiers[pid],
          totalDevoured: DevourProgress.totalDevoured[pid],
        };
      }
      this.sanctumUI.updateRunState(this.runState);
      this.sanctumUI.show();
    }
  }

  protected updateModeSpecific(_dt: number) {
    // Check realm clear
    if (!this.realmCleared && this.currentRealm) {
      const enemies = enemyQuery(world);
      let alive = 0;
      for (let i = 0; i < enemies.length; i++) {
        if (Health.current[enemies[i]] > 0) alive++;
      }
      if (alive === 0) {
        this.realmCleared = true;
        spawnVoiceOfTheWorld(9, 2);
      }
    }

    // Check if Sanctum descend was triggered
    if (this.sanctumUI && !this.sanctumUI.isVisible() && this.sanctumPending) {
      this.sanctumPending = false;
      this.descendFromSanctum();
    }
  }

  private sanctumPending = false;

  /** Called when SanctumUI's descend button is pressed. */
  onSanctumDescend() {
    this.sanctumPending = true;
  }

  private onPlayerDeath() {
    const oldDepth = this.runState.depth;
    this.runState = advanceRunOnDeath(this.runState);
    console.log(
      `%c[Death] %cYou died on depth ${oldDepth}. Entering Sanctum...`,
      "color: #ff4040; font-weight: bold;",
      "color: #e0e0e8;"
    );
    this.sanctumUI.updateRunState(this.runState);
    this.sanctumUI.show();
  }

  private descendFromSanctum() {
    const players = playerDeathCheckQuery(world);
    const isVoluntary = players.length > 0;

    if (isVoluntary && !this.realmCleared) {
      // Voluntary return — same depth
    } else if (this.realmCleared) {
      // Realm cleared — next depth
      this.runState = { ...this.runState, depth: this.runState.depth + 1, runNumber: this.runState.runNumber + 1 };
    }

    this.syncOwnedSkills();
    this.generateAndLoadRealm();

    if (this.currentRealm) {
      const intro = REALM_INTROS[this.currentRealm.biome];
      if (intro) {
        spawnVoiceOfTheWorld(7, 2);
        console.log(`%c${intro.intro}`, "color: #8888a0; font-style: italic;");
      }
    }

    this.hud.setRealmName(this.currentRealm?.name ?? "Unknown");
  }

  private syncOwnedSkills() {
    playerSkills.length = 0;
    for (const skill of this.runState.ownedSkills) playerSkills.push(skill);
    rebuildSkillStatsCache();
  }

  private generateAndLoadRealm() {
    clearAllEntities();
    this.realmCleared = false;

    const dp = this.runState.devourProgress;
    const essenceSalt = computeEssenceSalt(
      dp.totalDevoured, dp.unlockedElements, dp.unlockedForms, dp.unlockedVectors, dp.unlockedModifiers
    );

    this.currentRealm = generateRealm(
      this.runState.baseSeed, essenceSalt, this.runState.runNumber, this.runState.depth
    );

    this.setupTilemap(this.currentRealm.tiles, this.currentRealm.width, this.currentRealm.height, this.currentRealm.biome);
    this.spawnRealmEntities();

    this.hud.setRealmName(this.currentRealm.name);
    this.hud.hideLoading();
  }

  private spawnRealmEntities() {
    if (!this.currentRealm) return;
    const realm = this.currentRealm;
    const biome = getBiomeForDepth(this.runState.depth);

    const start = realm.playerStart;
    const startWorld = tileToWorld(start.col, start.row);
    const pid = spawnPlayerWithSkills(startWorld.x, startWorld.y, this.runState.equippedSkillIndices);

    addDevourProgressToPlayer(pid);
    if (hasComponent(world, DevourProgress, pid)) {
      DevourProgress.unlockedElements[pid] = this.runState.devourProgress.unlockedElements;
      DevourProgress.unlockedForms[pid] = this.runState.devourProgress.unlockedForms;
      DevourProgress.unlockedVectors[pid] = this.runState.devourProgress.unlockedVectors;
      DevourProgress.unlockedModifiers[pid] = this.runState.devourProgress.unlockedModifiers;
      DevourProgress.totalDevoured[pid] = this.runState.devourProgress.totalDevoured;
    }

    const enemyTypeIds = biome.enemyTypeIds;
    const statMult = biome.enemyStatMultiplier;
    for (let i = 0; i < realm.enemySpawns.length; i++) {
      const spawn = realm.enemySpawns[i];
      const w = tileToWorld(spawn.col, spawn.row);
      const eid = spawnEnemy(w.x, w.y);
      const typeId = enemyTypeIds[i % enemyTypeIds.length];
      setEnemyType(eid, typeId);
      if (hasComponent(world, Health, eid)) {
        Health.max[eid] *= statMult;
        Health.current[eid] = Health.max[eid];
      }
    }

    const bossWorld = tileToWorld(realm.bossSpawn.col, realm.bossSpawn.row);
    const bossEid = spawnEnemy(bossWorld.x, bossWorld.y);
    setEnemyType(bossEid, realm.bossTypeId);
    if (hasComponent(world, Health, bossEid)) {
      Health.max[bossEid] *= statMult * 1.5;
      Health.current[bossEid] = Health.max[bossEid];
    }
  }
}
