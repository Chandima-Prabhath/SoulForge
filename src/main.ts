/**
 * SoulForge — entry point.
 *
 * Boots the GameApp. Keeps a global reference for debugging in the console
 * (e.g., `window.__soulforge`).
 */

import { GameApp } from "./client/GameApp";

declare global {
  interface Window {
    __soulforge?: GameApp;
  }
}

async function main() {
  const app = new GameApp();
  try {
    await app.init();
    app.start();
    window.__soulforge = app;
    console.log(
      "%cSoulForge %cPhase 3 — Devour System\nDev console: window.__soulforge",
      "color: #ffb86c; font-weight: bold; font-size: 14px;",
      "color: #8888a0;"
    );
  } catch (err) {
    console.error("SoulForge failed to start:", err);
    const loading = document.getElementById("loading");
    if (loading) {
      loading.textContent = "Failed to summon. Check console for details.";
      loading.style.color = "#ff5555";
    }
  }
}

main();
