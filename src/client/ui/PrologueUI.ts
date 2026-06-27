/**
 * PrologueUI — the isekai summoning sequence shown on first load.
 *
 * Per README §7: "2-3 minute isekai summoning → tutorial naturally → first realm"
 *
 * This is a full-screen cinematic overlay that plays through PROLOGUE_BEATS.
 * Each beat displays text for a duration, then auto-advances (or on click).
 * The final beat fades into the game.
 *
 * Design: minimal, atmospheric. Text fades in/out. Background color shifts
 * per beat to match the narrative tone (dark → purple → green for the rift).
 */

import { PROLOGUE_BEATS, type PrologueBeat } from "@data/narrative";

export class PrologueUI {
  private container: HTMLElement;
  private textEl: HTMLElement;
  private speakerEl: HTMLElement;
  private onCompleteCallback: () => void;
  private currentBeatIndex: number = 0;
  private timeoutId: number | null = null;
  private isActive: boolean = false;

  constructor(onComplete: () => void) {
    this.onCompleteCallback = onComplete;
    this.container = document.createElement("div");
    this.container.id = "prologue-overlay";
    this.container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #0a0a0f;
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 1.5s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", serif;
    `;

    const inner = document.createElement("div");
    inner.style.cssText = `
      max-width: 700px;
      padding: 40px;
      text-align: center;
    `;

    this.speakerEl = document.createElement("div");
    this.speakerEl.style.cssText = `
      color: #ffb86c;
      font-size: 14px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 16px;
      opacity: 0;
      transition: opacity 0.8s ease;
      min-height: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;
    inner.appendChild(this.speakerEl);

    this.textEl = document.createElement("div");
    this.textEl.style.cssText = `
      color: #e8e8f0;
      font-size: 22px;
      line-height: 1.6;
      letter-spacing: 0.02em;
      opacity: 0;
      transition: opacity 1.2s ease;
      font-family: Georgia, "Times New Roman", serif;
      font-style: italic;
    `;
    inner.appendChild(this.textEl);

    // Click hint
    const hint = document.createElement("div");
    hint.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      color: #444450;
      font-size: 11px;
      letter-spacing: 0.1em;
      font-family: -apple-system, sans-serif;
      pointer-events: none;
    `;
    hint.textContent = "click / space / enter to continue";

    this.container.appendChild(inner);
    this.container.appendChild(hint);
    document.body.appendChild(this.container);

    // Click to advance (preventDefault to avoid text selection)
    this.container.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.advance();
    });
    this.container.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.advance();
    });

    // Keyboard: Space / Enter to advance
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        this.advance();
      }
    };
    window.addEventListener("keydown", this.keydownHandler);
  }

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Start the prologue sequence.
   */
  start() {
    this.isActive = true;
    this.currentBeatIndex = 0;
    this.container.style.display = "flex";
    this.showBeat(PROLOGUE_BEATS[0]);
  }

  /**
   * Show a specific prologue beat.
   */
  private showBeat(beat: PrologueBeat) {
    // Fade out current text
    this.textEl.style.opacity = "0";
    this.speakerEl.style.opacity = "0";

    // Update background color
    if (beat.color) {
      this.container.style.backgroundColor = beat.color;
    }

    // After fade out, update text and fade in
    setTimeout(() => {
      this.textEl.textContent = beat.text;
      this.speakerEl.textContent = beat.speaker || "";

      this.textEl.style.opacity = "1";
      if (beat.speaker) {
        this.speakerEl.style.opacity = "0.8";
      }

      // Auto-advance after duration
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = window.setTimeout(() => {
        this.advance();
      }, beat.duration * 1000);
    }, 600);
  }

  /**
   * Advance to the next beat (or complete if at end).
   */
  private advance() {
    if (!this.isActive) return;

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.currentBeatIndex++;

    if (this.currentBeatIndex >= PROLOGUE_BEATS.length) {
      this.complete();
      return;
    }

    this.showBeat(PROLOGUE_BEATS[this.currentBeatIndex]);
  }

  /**
   * Complete the prologue and fade out.
   */
  private complete() {
    this.isActive = false;
    this.textEl.style.opacity = "0";
    this.speakerEl.style.opacity = "0";

    // Remove keyboard listener
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }

    setTimeout(() => {
      this.container.style.opacity = "0";
      setTimeout(() => {
        this.container.style.display = "none";
        this.container.style.opacity = "1";
        this.onCompleteCallback();
      }, 1500);
    }, 500);
  }

  /**
   * Check if the prologue is currently active.
   */
  isPlaying(): boolean {
    return this.isActive;
  }
}
