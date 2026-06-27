// Browser-side combat test for SoulForge Phase 1
// Run via: agent-browser eval "$(cat /home/z/my-project/scripts/combat-test.js)"
//
// This script:
//   1. Verifies initial state (100 HP, 5 enemies at spawn)
//   2. Casts Mana Bolt 4 times toward the closest enemy
//   3. Verifies the enemy took damage (enemy count drops or HP drops)
//   4. Reports results

(() => {
  const results = {};
  
  // Initial state
  const hpBefore = document.getElementById('hud-hp')?.textContent;
  const enemiesBefore = document.getElementById('hud-enemies')?.textContent;
  results.before = { hp: hpBefore, enemies: enemiesBefore };
  
  // Helper: cast Mana Bolt toward a screen point
  function cast(sx, sy) {
    const canvas = document.getElementById('soulforge-canvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + sx,
      clientY: rect.top + sy,
      button: 2,
      bubbles: true
    }));
  }
  
  // Player is at world (0, 192) = screen center (640, 360)
  // Closest enemy is at tile (14, 14) → world (0, 448) → 256px below player → screen (640, 616)
  // Cast 4 times with 500ms gaps (cooldown is 450ms)
  const casts = [];
  for (let i = 0; i < 4; i++) {
    casts.push(new Promise(resolve => {
      setTimeout(() => {
        cast(640, 616);
        setTimeout(() => {
          resolve({
            enemies: document.getElementById('hud-enemies')?.textContent,
            hp: document.getElementById('hud-hp')?.textContent,
            cd: document.getElementById('hud-cd')?.textContent
          });
        }, 200);
      }, i * 500);
    }));
  }
  
  return Promise.all(casts).then(castResults => {
    results.casts = castResults;
    results.after = {
      enemies: document.getElementById('hud-enemies')?.textContent,
      hp: document.getElementById('hud-hp')?.textContent
    };
    return JSON.stringify(results);
  });
})()
