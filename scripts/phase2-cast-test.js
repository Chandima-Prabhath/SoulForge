// Test all 3 starter skills in Phase 2
// Player is at world (0, 192) = screen center (640, 360)
// Closest enemy is at tile (14, 14) → world (0, 448) → 256px below player → screen (640, 616)

(() => {
  const results = { before: {}, tests: [] };

  results.before = {
    hp: document.getElementById('hud-hp')?.textContent,
    enemies: document.getElementById('hud-enemies')?.textContent,
    slot0Cd: document.getElementById('hud-slot0-cd')?.textContent,
    slot1Cd: document.getElementById('hud-slot1-cd')?.textContent,
    slot2Cd: document.getElementById('hud-slot2-cd')?.textContent,
  };

  function pressKey(k) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })), 50);
  }

  function cast(slot, sx, sy) {
    const canvas = document.getElementById('soulforge-canvas');
    const rect = canvas.getBoundingClientRect();
    if (slot === 0) {
      // right-click
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + sx, clientY: rect.top + sy, button: 2, bubbles: true
      }));
    } else {
      // move mouse, then press number key
      const moveEvt = new MouseEvent('mousemove', { clientX: rect.left + sx, clientY: rect.top + sy, bubbles: true });
      window.dispatchEvent(moveEvt);
      pressKey(String(slot + 1));
    }
  }

  function snapshot(label) {
    return {
      label,
      hp: document.getElementById('hud-hp')?.textContent,
      enemies: document.getElementById('hud-enemies')?.textContent,
      slot0Cd: document.getElementById('hud-slot0-cd')?.textContent,
      slot1Cd: document.getElementById('hud-slot1-cd')?.textContent,
      slot2Cd: document.getElementById('hud-slot2-cd')?.textContent,
    };
  }

  // Test 1: Cast Mana Bolt (slot 0) via right-click toward enemy
  return new Promise(resolve => {
    cast(0, 640, 616);  // right-click toward enemy
    setTimeout(() => {
      results.tests.push(snapshot('after Mana Bolt cast'));
      // Wait for cooldown
      setTimeout(() => {
        // Test 2: Cast Frost Nova (slot 1) — it's a Self nova, so just press 2
        pressKey('2');
        setTimeout(() => {
          results.tests.push(snapshot('after Frost Nova cast'));
          setTimeout(() => {
            // Test 3: Cast Lightning Beam (slot 2) toward enemy
            cast(2, 640, 616);
            setTimeout(() => {
              results.tests.push(snapshot('after Lightning Beam cast'));
              // Wait 1s and take final state
              setTimeout(() => {
                results.after = snapshot('1s after all casts');
                resolve(JSON.stringify(results));
              }, 1000);
            }, 100);
          }, 1500);  // frost nova cooldown is 2s
        }, 100);
      }, 600);  // mana bolt cooldown is 0.45s
    }, 100);
  });
})()
