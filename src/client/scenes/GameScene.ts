/**
 * GameScene — base class for MatchScene and RealmScene.
 *
 * Shared functionality:
 *   - Entity rendering (EntityRenderer.sync())
 *   - Camera follow
 *   - HUD updates
 *   - Input handling
 *   - Common ECS systems (movement, combat, skills, devour, etc.)
 *
 * Subclasses override:
 *   - onEnter(): spawn entities specific to the mode
 *   - onExit(): cleanup specific to the mode
 *   - update(dt): add mode-specific systems
 */

import { Application, Container } from "pixi.js";
import { Scene } from "./SceneManager";
import { EntityRenderer } from "../render/EntityRenderer";
import { CameraController } from "../render/CameraController";
import { IsoTilemap } from "../render/IsoTilemap";
import { InputManager } from "../input/InputManager";
import { HUD } from "../ui/HUD";
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
  lingeringAreaSystem,
  growModifierSystem,
} from "@core/ecs/systems/combatSystems";
import {
  castSkillSystem,
  novaSystem,
  beamSystem,
  statusEffectSystem,
  skillCooldownSystem,
} from "@core/ecs/systems/skillSystems";
import {
  autoDevourSystem,
  devourSkillSystem,
  voiceOfTheWorldSystem,
} from "@core/ecs/systems/devourSystems";

export abstract class GameScene extends Scene {
  protected entityRenderer: EntityRenderer;
  protected camera: CameraController;
  protected input: InputManager;
  protected hud: HUD;
  protected tilemap: IsoTilemap | null = null;
  protected rKeyHeld = false;

  constructor(app: Application, worldContainer: Container) {
    super(app, worldContainer);
    this.entityRenderer = new EntityRenderer();
    this.worldContainer.addChild(this.entityRenderer.container);

    this.camera = new CameraController(
      this.worldContainer,
      app.screen.width,
      app.screen.height
    );

    this.input = new InputManager((sx, sy) => this.camera.screenToWorld(sx, sy));
    this.hud = new HUD("Loading...");
  }

  protected setupCameraZoom(zoom: number) {
    this.worldContainer.scale.set(zoom);
  }

  protected setupTilemap(tiles: number[], width: number, height: number, biomeId: string) {
    if (this.tilemap) {
      this.worldContainer.removeChild(this.tilemap.container);
      this.tilemap.container.destroy();
    }
    this.tilemap = new IsoTilemap({
      name: "",
      biome: biomeId,
      width,
      height,
      tiles,
      playerStart: { col: 0, row: 0 },
      enemySpawns: [],
    });
    this.worldContainer.addChildAt(this.tilemap.container, 0);
  }

  protected setupInput(canvas: HTMLCanvasElement) {
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
  }

  protected handleRKey() {
    if (!this.input.isRPressed() || this.rKeyHeld) return;
    this.rKeyHeld = true;
    // Subclasses override this for mode-specific R behavior
  }

  protected runCommonSystems(dt: number) {
    // Input
    this.input.update();

    // R key
    if (!this.input.isRPressed()) this.rKeyHeld = false;
    this.handleRKey();

    // Skill casts
    const casts = this.input.consumeCastRequests();
    for (let i = 0; i < casts.length; i++) {
      const c = casts[i];
      if (c.active) {
        castSkillSystem(dt, { slot: c.slot, targetX: c.targetX, targetY: c.targetY, active: true });
      }
    }
    this.input.clearCastRequests();

    // Devour
    const devourRequested = this.input.consumeDevourRequest();
    if (devourRequested) {
      devourSkillSystem(dt, { active: true });
    }

    // Common simulation systems
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
  }

  protected renderScene(dt: number) {
    this.camera.update(dt);
    this.entityRenderer.sync();
    this.hud.update(dt);
  }

  protected showHud() {
    const ids = ["hud-topleft", "hud-topright", "hud-skillbar", "hud-devour-btn", "hud-sanctum-btn"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = "flex";
    }
  }

  protected hideHud() {
    const ids = ["hud-topleft", "hud-topright", "hud-skillbar", "hud-devour-btn", "hud-sanctum-btn"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }
  }

  update(dt: number) {
    this.runCommonSystems(dt);
    this.updateModeSpecific(dt);
    this.renderScene(dt);
  }

  /** Subclasses implement mode-specific systems (match state, realm clear, etc.) */
  protected abstract updateModeSpecific(dt: number): void;
}
