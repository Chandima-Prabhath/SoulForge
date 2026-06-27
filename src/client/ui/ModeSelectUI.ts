/**
 * ModeSelectUI — shown after the prologue, lets the player choose
 * between Realm mode (roguelite) and Match mode (AoV-style quick battle).
 *
 * Also accessible from the Sanctum (a "Play Match" button).
 */

export type GameMode = "realm" | "match";

export class ModeSelectUI {
  private container: HTMLElement;
  private onSelectCallback: (mode: GameMode) => void;

  constructor(onSelect: (mode: GameMode) => void) {
    this.onSelectCallback = onSelect;
    this.container = document.createElement("div");
    this.container.id = "mode-select-overlay";
    this.container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(ellipse at center, #1a0a2a 0%, #0a0510 60%, #050308 100%);
      z-index: 1500;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e8e8f0;
    `;

    // Add floating particles for atmosphere
    this.createParticles();

    document.body.appendChild(this.container);
  }

  private createParticles() {
    const particleContainer = document.createElement("div");
    particleContainer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      overflow: hidden;
    `;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement("div");
      const size = 2 + Math.random() * 3;
      const left = Math.random() * 100;
      const duration = 15 + Math.random() * 15;
      const delay = Math.random() * -duration;
      const opacity = 0.1 + Math.random() * 0.2;
      const color = Math.random() > 0.5 ? "#d0a0ff" : "#ffb86c";

      particle.style.cssText = `
        position: absolute;
        width: ${size}px; height: ${size}px;
        background: ${color};
        border-radius: 50%;
        left: ${left}%; bottom: -10px;
        opacity: ${opacity};
        box-shadow: 0 0 ${size * 2}px ${color};
        animation: floatUpMode ${duration}s linear infinite;
        animation-delay: ${delay}s;
      `;
      particleContainer.appendChild(particle);
    }

    if (!document.getElementById("mode-select-particle-style")) {
      const style = document.createElement("style");
      style.id = "mode-select-particle-style";
      style.textContent = `
        @keyframes floatUpMode {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    this.container.appendChild(particleContainer);
  }

  show() {
    this.render();
    this.container.style.display = "flex";
  }

  hide() {
    this.container.style.display = "none";
  }

  isVisible(): boolean {
    return this.container.style.display === "flex";
  }

  private render() {
    this.container.innerHTML = `
      <div style="position: relative; z-index: 1; text-align: center; max-width: 700px; padding: 40px 20px;">

        <h1 style="font-size: 36px; color: #ffb86c; letter-spacing: 0.2em; margin: 0 0 8px 0; text-shadow: 0 0 30px rgba(255,184,108,0.4);">
          SOULFORGE
        </h1>
        <p style="color: #8888a0; font-size: 13px; letter-spacing: 0.1em; margin: 0 0 40px 0;">
          Choose your path, anomaly.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 600px; margin: 0 auto;">

          <!-- Realm Mode -->
          <button id="mode-realm" style="
            background: linear-gradient(135deg, rgba(74,124,58,0.3) 0%, rgba(40,60,30,0.3) 100%);
            border: 2px solid rgba(74,124,58,0.5);
            border-radius: 16px;
            padding: 30px 20px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            color: #e8e8f0;
          ">
            <div style="font-size: 48px; margin-bottom: 12px;">⚔</div>
            <div style="font-size: 20px; font-weight: bold; color: #80c060; margin-bottom: 8px;">REALM</div>
            <div style="font-size: 12px; color: #8888a0; line-height: 1.5;">
              Descend into procedural realms.<br>
              Devour enemies, unlock atoms,<br>
              craft skills. Roguelite loop.
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #80c060; font-weight: 600;">
              Depth ${this.getCurrentDepth()}
            </div>
          </button>

          <!-- Match Mode -->
          <button id="mode-match" style="
            background: linear-gradient(135deg, rgba(255,184,108,0.2) 0%, rgba(255,96,32,0.1) 100%);
            border: 2px solid rgba(255,184,108,0.4);
            border-radius: 16px;
            padding: 30px 20px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            color: #e8e8f0;
          ">
            <div style="font-size: 48px; margin-bottom: 12px;">🏰</div>
            <div style="font-size: 20px; font-weight: bold; color: #ffb86c; margin-bottom: 8px;">MATCH</div>
            <div style="font-size: 12px; color: #8888a0; line-height: 1.5;">
              Quick 10-20 min battle.<br>
              2 lanes, minion waves,<br>
              destroy the enemy core.
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #ffb86c; font-weight: 600;">
              AoV-inspired
            </div>
          </button>

        </div>

        <p style="color: #444450; font-size: 11px; margin-top: 30px; letter-spacing: 0.05em;">
          Your skills and devour progress carry over between modes.
        </p>
      </div>
    `;

    // Re-add particles (innerHTML cleared them)
    this.createParticles();

    // Attach listeners
    const realmBtn = document.getElementById("mode-realm");
    const matchBtn = document.getElementById("mode-match");

    if (realmBtn) {
      realmBtn.addEventListener("mouseenter", () => {
        realmBtn.style.transform = "translateY(-4px)";
        realmBtn.style.borderColor = "#80c060";
      });
      realmBtn.addEventListener("mouseleave", () => {
        realmBtn.style.transform = "translateY(0)";
        realmBtn.style.borderColor = "rgba(74,124,58,0.5)";
      });
      realmBtn.addEventListener("click", () => {
        this.hide();
        this.onSelectCallback("realm");
      });
    }

    if (matchBtn) {
      matchBtn.addEventListener("mouseenter", () => {
        matchBtn.style.transform = "translateY(-4px)";
        matchBtn.style.borderColor = "#ffb86c";
      });
      matchBtn.addEventListener("mouseleave", () => {
        matchBtn.style.transform = "translateY(0)";
        matchBtn.style.borderColor = "rgba(255,184,108,0.4)";
      });
      matchBtn.addEventListener("click", () => {
        this.hide();
        this.onSelectCallback("match");
      });
    }
  }

  private getCurrentDepth(): number {
    // This is a placeholder — the actual depth comes from the run state
    // which is passed when the ModeSelectUI is shown
    return 1;
  }
}
