/**
 * LoadingScene — shows loading screen, then transitions to ModeSelect.
 *
 * This is the first scene. It initializes the game state (RunState, skills)
 * and then transitions to the mode select screen.
 */

import { Application, Container } from "pixi.js";
import { Scene } from "./SceneManager";

export class LoadingScene extends Scene {
  private onReady: () => void;

  constructor(app: Application, worldContainer: Container, onReady: () => void) {
    super(app, worldContainer);
    this.onReady = onReady;
  }

  onEnter() {
    // Show loading text (already in DOM from index.html)
    const loading = document.getElementById("loading");
    if (loading) {
      loading.textContent = "Summoning the Sanctum...";
      loading.style.display = "block";
    }

    // Simulate brief loading, then signal ready
    setTimeout(() => {
      this.onReady();
    }, 500);
  }

  onExit() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }

  update(_dt: number) {
    // Nothing to update — just waiting for onReady callback
  }
}
