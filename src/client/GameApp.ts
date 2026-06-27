/**
 * GameApp — the PixiJS application and main loop.
 *
 * Owns:
 *  - Pixi Application (renderer)
 *  - World container (everything in the game world is a child of this)
 *  - IsoTilemap, EntityRenderer, CameraController
 *  - InputManager
 *  - HUD
 *
 * Main loop order (each frame):
 *   1. Read input → ECS (movement + cast request)
 *   2. Step simulation systems in dependency order:
 *      cooldown → facing → attack → projectile → collision → enemyAI →
 *      movement → damageNumber → cleanupDead → lifetime
 *   3. Update camera (reads from ECS)
 *   4. Sync renderers (reads ECS, writes Pixi display objects)
 *   5. Update HUD
 *   6. Check for player death → respawn on R key
 */

import { Application, Container } from "pixi.js";
import { IsoTilemap } from "./render/IsoTilemap";
import { EntityRenderer } from "./render/EntityRenderer";
import { CameraController } from "./render/CameraController";
import { InputManager } from "./input/InputManager";
import { HUD } from "./ui/HUD";
import { movementSystem } from "@core/ecs/systems/movementSystem";
import {
  attackSystem,
  cooldownSystem,
  facingSystem,
  projectileSystem,
  collisionSystem,
  enemyAISystem,
  damageNumberSystem,
  lifetimeSystem,
  cleanupDeadEntities,
  spawnPlayerFull,
  spawnEnemy,
  clearAllEntities,
} from "@core/ecs/systems/combatSystems";
import { tileToWorld } from "@core/iso";
import { verdantRiftPrototype } from "@data/realms";

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

  constructor() {
    this.app = new Application();
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

    // Tilemap
    this.tilemap = new IsoTilemap(verdantRiftPrototype);
    this.worldContainer.addChild(this.tilemap.container);

    // Entity renderer
    this.entityRenderer = new EntityRenderer();
    this.worldContainer.addChild(this.entityRenderer.container);

    // Spawn the player and enemies
    this.spawnRealmEntities();

    // Camera
    this.camera = new CameraController(
      this.worldContainer,
      this.app.screen.width,
      this.app.screen.height
    );

    // Input — pass a screen-to-world function bound to the camera
    this.input = new InputManager((sx, sy) => this.camera.screenToWorld(sx, sy));

    // Click handling on the canvas — left = move, right = cast
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.button === 2) {
        // right click — cast
        this.input.onCanvasRightClick(sx, sy);
      } else if (e.button === 0) {
        // left click — move
        this.input.onCanvasLeftClick(sx, sy);
      }
    });

    // HUD
    this.hud = new HUD(verdantRiftPrototype.name);
    this.hud.hideLoading();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.camera.resize(this.app.screen.width, this.app.screen.height);
    });

    // Enable sortable children for depth ordering
    this.worldContainer.sortableChildren = true;
  }

  /**
   * Spawn the player at the realm start + all enemies from the realm data.
   */
  private spawnRealmEntities() {
    const start = verdantRiftPrototype.playerStart;
    const startWorld = tileToWorld(start.col, start.row);
    spawnPlayerFull(startWorld.x, startWorld.y);

    for (const spawn of verdantRiftPrototype.enemySpawns) {
      const w = tileToWorld(spawn.col, spawn.row);
      spawnEnemy(w.x, w.y);
    }
  }

  /**
   * Respawn: clear all entities, re-spawn player + enemies.
   */
  respawn() {
    clearAllEntities();
    this.spawnRealmEntities();
    console.log("%c[SoulForge] Respawned", "color: #ffb86c");
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.app.ticker.add(this.tick);
  }

  private tick = () => {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    // ── Step 1: input → ECS ────────────────────────────────────────────
    this.input.update();
    const cast = this.input.consumeCastRequest();

    // R key respawn (edge-triggered so holding R doesn't spam respawns)
    if (this.input.isRPressed() && !this.rKeyHeld) {
      this.rKeyHeld = true;
      this.respawn();
    } else if (!this.input.isRPressed()) {
      this.rKeyHeld = false;
    }

    // ── Step 2: simulation systems in dependency order ────────────────
    cooldownSystem(dt);
    facingSystem(dt);
    attackSystem(dt, cast);
    projectileSystem(dt);
    enemyAISystem(dt);
    movementSystem(dt);
    collisionSystem();
    damageNumberSystem(dt);
    cleanupDeadEntities();
    lifetimeSystem();

    // ── Step 3: camera → world container ───────────────────────────────
    this.camera.update(dt);

    // ── Step 4: sync renderers ─────────────────────────────────────────
    this.entityRenderer.sync();

    // ── Step 5: HUD ────────────────────────────────────────────────────
    this.hud.update(dt);
  };

  destroy() {
    this.running = false;
    this.app.ticker.remove(this.tick);
    this.input.dispose();
    this.app.destroy(true);
  }
}
