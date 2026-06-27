/**
 * ModeSelectScene — shows the mode selection screen.
 *
 * Player chooses between Realm (roguelite) and Match (MOBA).
 * This scene hides the game world and shows the ModeSelectUI overlay.
 */

import { Application, Container } from "pixi.js";
import { Scene } from "./SceneManager";
import { ModeSelectUI, type GameMode } from "../ui/ModeSelectUI";

export class ModeSelectScene extends Scene {
  private modeSelectUI: ModeSelectUI;
  private onModeSelected: (mode: GameMode) => void;

  constructor(
    app: Application,
    worldContainer: Container,
    onModeSelected: (mode: GameMode) => void
  ) {
    super(app, worldContainer);
    this.onModeSelected = onModeSelected;
    this.modeSelectUI = new ModeSelectUI((mode: GameMode) => {
      this.onModeSelected(mode);
    });
  }

  onEnter() {
    // Hide the game world (no entities should be visible)
    this.worldContainer.visible = false;

    // Hide game HUD
    const hudElements = ["hud-topleft", "hud-topright", "hud-skillbar", "hud-devour-btn", "hud-sanctum-btn"];
    for (const id of hudElements) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }

    // Show mode select
    this.modeSelectUI.show();
  }

  onExit() {
    this.modeSelectUI.hide();

    // Show game world again
    this.worldContainer.visible = true;
  }

  update(_dt: number) {
    // Nothing to simulate — just UI
  }
}
