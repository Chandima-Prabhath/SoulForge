/**
 * GameApp — the PixiJS application and main loop.
 *
 * Owns:
 *  - Pixi Application (renderer)
 *  - World container (everything in the game world is a child of this)
 *  - IsoTilemap, EntityRenderer, CameraController
 *  - InputManager
 *  - HUD
 *  - Fixed-timestep simulation loop
 *
 * Main loop:
 *   1. Compute frame dt (clamped).
 *   2. Step the simulation at a fixed 60 Hz (movementSystem).
 *      (For Phase 0, dt is small enough that one step per frame suffices.)
 *   3. Update input (writes to ECS).
 *   4. Update camera (reads from ECS).
 *   5. Sync renderers (reads from ECS, writes to Pixi display objects).
 *   6. Update HUD.
 */

import { Application, Container } from "pixi.js";
import { IsoTilemap } from "./render/IsoTilemap";
import { EntityRenderer } from "./render/EntityRenderer";
import { CameraController } from "./render/CameraController";
import { InputManager } from "./input/InputManager";
import { HUD } from "./ui/HUD";
import { movementSystem, spawnPlayer } from "@core/ecs/systems/movementSystem";
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
    // The camera moves this container to follow the player.
    this.worldContainer = new Container();
    this.worldContainer.label = "World";
    this.app.stage.addChild(this.worldContainer);

    // Tilemap
    this.tilemap = new IsoTilemap(verdantRiftPrototype);
    this.worldContainer.addChild(this.tilemap.container);

    // Entity renderer
    this.entityRenderer = new EntityRenderer();
    this.worldContainer.addChild(this.entityRenderer.container);

    // Spawn the player at the realm's start tile
    const start = verdantRiftPrototype.playerStart;
    const startWorld = tileToWorld(start.col, start.row);
    spawnPlayer(startWorld.x, startWorld.y);

    // Camera
    this.camera = new CameraController(
      this.worldContainer,
      this.app.screen.width,
      this.app.screen.height
    );

    // Input — pass a screen-to-world function bound to the camera
    this.input = new InputManager((sx, sy) => this.camera.screenToWorld(sx, sy));

    // Click handling on the canvas
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.input.onCanvasClick(sx, sy);
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
    // Clamp dt to avoid spiral-of-death on slow frames / tab switches
    if (dt > 0.1) dt = 0.1;

    // Step 1: input → ECS
    this.input.update();

    // Step 2: simulation (fixed-step would go here; for Phase 0 we use frame dt)
    movementSystem(dt);

    // Step 3: camera → world container
    this.camera.update(dt);

    // Step 4: sync renderers (read ECS, update Pixi)
    this.entityRenderer.sync();

    // Step 5: HUD
    this.hud.update(dt);
  };

  destroy() {
    this.running = false;
    this.app.ticker.remove(this.tick);
    this.input.dispose();
    this.app.destroy(true);
  }
}
