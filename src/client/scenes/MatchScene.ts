/**
 * MatchScene — MOBA match mode with proper game flow.
 *
 * Features:
 *   - 72x72 map with 3-tile-wide lanes
 *   - Camera zoomed in (only ~25 tiles visible)
 *   - Player respawn (5s timer, respawn at core)
 *   - Match timer, wave count in HUD
 *   - Victory/Defeat detection
 *   - Match results → return to mode select
 */

import { Application, Container } from "pixi.js";
import { GameScene } from "./GameScene";
import { defineQuery, hasComponent } from "bitecs";
import {
  world,
  PlayerTag,
  Position,
  Health,
  DevourProgress,
  MatchState,
} from "@core/ecs/world";
import {
  startMatch,
  endMatch,
  getMatchArena,
  matchStateSystem,
  minionAISystem,
  structureAISystem,
  cleanupMatchEntities,
} from "@core/ecs/systems/matchSystems";
import { spawnPlayerWithSkills } from "@core/ecs/systems/skillSystems";
import { addDevourProgressToPlayer } from "@core/ecs/systems/devourSystems";
import { tileToWorld } from "@core/iso";
import { clearAllEntities } from "@core/ecs/systems/combatSystems";
import { spawnVoiceOfTheWorld } from "@core/ecs/systems/devourSystems";
import type { RunState } from "@core/realm/runState";

const playerQuery = defineQuery([PlayerTag, Position, Health]);
const matchStateQuery = defineQuery([MatchState]);

export class MatchScene extends GameScene {
  private runState: RunState;
  private onMatchEnd: () => void;
  private matchEnding = false;
  private respawnTimer = 0;
  private isDead = false;

  constructor(
    app: Application,
    worldContainer: Container,
    runState: RunState,
    onMatchEnd: () => void
  ) {
    super(app, worldContainer);
    this.runState = runState;
    this.onMatchEnd = onMatchEnd;
  }

  onEnter() {
    // Clear everything
    clearAllEntities();

    // Start the match
    startMatch();

    // Sync skills
    const { playerSkills, rebuildSkillStatsCache: rebuild } = require("@core/ecs/systems/skillSystems");
    playerSkills.length = 0;
    for (const skill of this.runState.ownedSkills) playerSkills.push(skill);
    rebuild();

    // Spawn player
    const arena = getMatchArena();
    if (!arena) return;

    const startWorld = tileToWorld(arena.playerStart.col, arena.playerStart.row);
    const pid = spawnPlayerWithSkills(
      startWorld.x,
      startWorld.y,
      this.runState.equippedSkillIndices
    );

    // Restore DevourProgress
    addDevourProgressToPlayer(pid);
    if (hasComponent(world, DevourProgress, pid)) {
      DevourProgress.unlockedElements[pid] = this.runState.devourProgress.unlockedElements;
      DevourProgress.unlockedForms[pid] = this.runState.devourProgress.unlockedForms;
      DevourProgress.unlockedVectors[pid] = this.runState.devourProgress.unlockedVectors;
      DevourProgress.unlockedModifiers[pid] = this.runState.devourProgress.unlockedModifiers;
      DevourProgress.totalDevoured[pid] = this.runState.devourProgress.totalDevoured;
    }

    // Setup tilemap
    this.setupTilemap(arena.tiles, arena.width, arena.height, "forest");

    // Camera zoom — zoom in so only ~25 tiles visible
    this.setupCameraZoom(1.8);

    // HUD
    this.hud.setRealmName("Match Arena");
    this.hud.hideLoading();
    this.showHud();

    // Input
    const canvas = this.app.canvas;
    canvas.id = "soulforge-canvas";
    this.setupInput(canvas);

    // Reset state
    this.matchEnding = false;
    this.respawnTimer = 0;
    this.isDead = false;

    console.log(
      `%c[Match] %cMatch started! Destroy the enemy core to win.`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );
  }

  onExit() {
    endMatch();
    clearAllEntities();
    this.hideHud();
    this.matchEnding = false;
  }

  protected handleRKey() {
    // R does nothing in match mode (no Sanctum access mid-match)
  }

  protected updateModeSpecific(dt: number) {
    // Match systems
    matchStateSystem(dt);
    minionAISystem(dt);
    structureAISystem(dt);
    cleanupMatchEntities();

    // Player respawn logic
    const players = playerQuery(world);
    if (players.length === 0 && !this.matchEnding) {
      if (!this.isDead) {
        this.isDead = true;
        this.respawnTimer = 5; // 5 second respawn
        spawnVoiceOfTheWorld(8, 2);
        console.log(`%c[Match] %cYou died! Respawning in 5s...`, "color: #ff4040; font-weight: bold;", "color: #e0e0e8;");
      } else {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.respawnPlayer();
          this.isDead = false;
        }
      }
    }

    // Check for match end
    if (!this.matchEnding) {
      const matchStates = matchStateQuery(world);
      if (matchStates.length > 0) {
        const result = MatchState.result[matchStates[0]];
        if (result !== 0) {
          this.matchEnding = true;
          const resultText = result === 1 ? "VICTORY" : "DEFEAT";
          console.log(
            `%c[Match] %c${resultText}! Returning to mode select...`,
            "color: #ffb86c; font-weight: bold;",
            result === 1 ? "color: #40ff40;" : "color: #ff4040;"
          );
          spawnVoiceOfTheWorld(result === 1 ? 10 : 11, 2);
          setTimeout(() => {
            this.onMatchEnd();
            this.matchEnding = false;
          }, 3000);
        }
      }
    }
  }

  private respawnPlayer() {
    const arena = getMatchArena();
    if (!arena) return;

    const startWorld = tileToWorld(arena.playerStart.col, arena.playerStart.row);
    const pid = spawnPlayerWithSkills(
      startWorld.x,
      startWorld.y,
      this.runState.equippedSkillIndices
    );

    addDevourProgressToPlayer(pid);
    if (hasComponent(world, DevourProgress, pid)) {
      DevourProgress.unlockedElements[pid] = this.runState.devourProgress.unlockedElements;
      DevourProgress.unlockedForms[pid] = this.runState.devourProgress.unlockedForms;
      DevourProgress.unlockedVectors[pid] = this.runState.devourProgress.unlockedVectors;
      DevourProgress.unlockedModifiers[pid] = this.runState.devourProgress.unlockedModifiers;
      DevourProgress.totalDevoured[pid] = this.runState.devourProgress.totalDevoured;
    }

    spawnVoiceOfTheWorld(7, 1);
    console.log(`%c[Match] %cRespawned!`, "color: #40ff40; font-weight: bold;", "color: #e0e0e8;");
  }
}
