/**
 * GameApp — the PixiJS application and main loop.
 *
 * REWRITTEN to use SceneManager for proper game flow:
 *   LoadingScene → ModeSelectScene → MatchScene / RealmScene
 *
 * GameApp now just:
 *   1. Initializes Pixi
 *   2. Creates the SceneManager + all scenes
 *   3. Runs the main loop (delegates to SceneManager.update)
 *   4. Handles window resize
 */

import { Application, Container } from "pixi.js";
import { SceneManager } from "./scenes/SceneManager";
import { LoadingScene } from "./scenes/LoadingScene";
import { ModeSelectScene } from "./scenes/ModeSelectScene";
import { MatchScene } from "./scenes/MatchScene";
import { RealmScene } from "./scenes/RealmScene";
import { PrologueUI } from "./ui/PrologueUI";
import { SanctumUI } from "./ui/SanctumUI";
import { createNewRunState, type RunState } from "@core/realm/runState";
import type { GameMode } from "./ui/ModeSelectUI";

export class GameApp {
  private app: Application;
  private worldContainer!: Container;
  private sceneManager!: SceneManager;
  private runState: RunState;
  private prologueUI!: PrologueUI;
  private sanctumUI!: SanctumUI;
  private realmScene!: RealmScene;

  private lastTime = 0;
  private running = false;

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

    // World container
    this.worldContainer = new Container();
    this.worldContainer.label = "World";
    this.app.stage.addChild(this.worldContainer);
    this.worldContainer.sortableChildren = true;

    // Sanctum UI (shared between RealmScene and mode select)
    this.sanctumUI = new SanctumUI(this.runState, () => {
      this.realmScene.onSanctumDescend();
    });

    // Prologue (shown before mode select on first load)
    this.prologueUI = new PrologueUI(() => {
      // After prologue, go to mode select
      this.sceneManager.switchTo("modeSelect");
    });

    // Create scene manager
    this.sceneManager = new SceneManager(this.app, this.worldContainer);

    // Create and register scenes
    const loadingScene = new LoadingScene(this.app, this.worldContainer, () => {
      // After loading, show prologue (then prologue → mode select)
      this.prologueUI.start();
    });

    const modeSelectScene = new ModeSelectScene(
      this.app,
      this.worldContainer,
      (mode: GameMode) => this.onModeSelected(mode)
    );

    this.realmScene = new RealmScene(
      this.app,
      this.worldContainer,
      this.runState,
      this.sanctumUI,
      () => {
        // Return to mode select from realm
        this.sceneManager.switchTo("modeSelect");
      }
    );

    const matchScene = new MatchScene(
      this.app,
      this.worldContainer,
      this.runState,
      () => {
        // Return to mode select from match
        this.sceneManager.switchTo("modeSelect");
      }
    );

    this.sceneManager.register("loading", loadingScene);
    this.sceneManager.register("modeSelect", modeSelectScene);
    this.sceneManager.register("realm", this.realmScene);
    this.sceneManager.register("match", matchScene);

    // Start with loading scene
    this.sceneManager.switchTo("loading");

    // Window resize
    window.addEventListener("resize", () => {
      this.worldContainer.scale.set(this.worldContainer.scale.x); // preserve zoom
    });

    console.log(
      "%cSoulForge %cPhase 7 — MOBA Engine Overhaul\nDev console: window.__soulforge",
      "color: #ffb86c; font-weight: bold; font-size: 14px;",
      "color: #8888a0;"
    );
  }

  private onModeSelected(mode: GameMode) {
    console.log(`%c[Mode] %cSelected: ${mode}`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");
    if (mode === "realm") {
      this.sceneManager.switchTo("realm");
    } else if (mode === "match") {
      this.sceneManager.switchTo("match");
    }
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.app.ticker.add(this.tick);
  }

  private tick = () => {
    if (!this.running) return;

    // Pause during prologue
    if (this.prologueUI && this.prologueUI.isPlaying()) {
      this.lastTime = performance.now();
      return;
    }

    // Pause during Sanctum
    if (this.sanctumUI && this.sanctumUI.isVisible()) {
      this.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    // Delegate to scene manager
    this.sceneManager.update(dt);
  };

  destroy() {
    this.running = false;
    this.app.ticker.remove(this.tick);
    this.app.destroy(true);
  }
}
