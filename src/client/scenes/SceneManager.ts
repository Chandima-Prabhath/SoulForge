/**
 * Scene System — proper game engine architecture.
 *
 * Each scene is a self-contained game state with its own:
 *   - onEnter(): setup (spawn entities, build UI, etc.)
 *   - onExit(): cleanup (remove entities, hide UI, etc.)
 *   - update(dt): per-frame logic
 *   - render(): rendering (handled by EntityRenderer + scene-specific UI)
 *
 * The SceneManager ensures only one scene is active at a time and handles
 * clean transitions between scenes. No more "load everything then show overlay".
 *
 * Scene flow:
 *   LoadingScene → ModeSelectScene → MatchScene / RealmScene
 *                                           ↓
 *                                      ResultsScene → ModeSelectScene
 */

import { Application, Container } from "pixi.js";

export abstract class Scene {
  protected app: Application;
  protected worldContainer: Container;
  protected sceneContainer: Container;

  constructor(app: Application, worldContainer: Container) {
    this.app = app;
    this.worldContainer = worldContainer;
    this.sceneContainer = new Container();
    this.sceneContainer.label = this.constructor.name;
  }

  /** Called when this scene becomes active. Setup entities, UI, etc. */
  abstract onEnter(): void;

  /** Called when this scene is being replaced. Cleanup entities, UI, etc. */
  abstract onExit(): void;

  /** Per-frame update — simulation logic, input, etc. */
  abstract update(dt: number): void;

  /** Get the scene name for debugging. */
  get name(): string {
    return this.constructor.name;
  }
}

export class SceneManager {
  private currentScene: Scene | null = null;
  private scenes: Map<string, Scene> = new Map();

  constructor(_app: Application, _worldContainer: Container) {
    void _app;
    void _worldContainer;
  }

  /** Register a scene by name. */
  register(name: string, scene: Scene) {
    this.scenes.set(name, scene);
  }

  /** Transition to a registered scene. Calls onExit on current, onEnter on new. */
  switchTo(name: string) {
    if (this.currentScene) {
      console.log(`%c[Scene] %cExiting ${this.currentScene.name}`, "color: #8888a0;", "color: #8888a0;");
      this.currentScene.onExit();
    }

    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`[Scene] Scene "${name}" not found!`);
      return;
    }

    this.currentScene = scene;
    console.log(`%c[Scene] %cEntering ${scene.name}`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");
    scene.onEnter();
  }

  /** Get the currently active scene. */
  getCurrent(): Scene | null {
    return this.currentScene;
  }

  /** Get current scene name. */
  getCurrentName(): string {
    return this.currentScene?.name ?? "none";
  }

  /** Update the current scene. Called every frame by GameApp. */
  update(dt: number) {
    if (this.currentScene) {
      this.currentScene.update(dt);
    }
  }
}
