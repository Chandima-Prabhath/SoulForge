// Full combat test for Phase 2 — kill all 5 enemies using a mix of skills
// Player spawns at world (0, 192). Closest enemy at tile (14,14) = world (0, 448), 256px below.
// Cast toward (640, 616) screen = (0, 448) world.

(() => {
  const results = { steps: [] };

  function snap(label) {
    return {
      label,
      hp: document.getElementById('hud-hp')?.textContent,
      enemies: document.getElementById('hud-enemies')?.textContent,
      slot0Cd: document.getElementById('hud-slot0-cd')?.textContent,
      slot1Cd: document.getElementById('hud-slot1-cd')?.textContent,
      slot2Cd: document.getElementById('hud-slot2-cd')?.textContent,
    };
  }

  function pressKey(k) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })), 50);
  }

  function rightClick(sx, sy) {
    const canvas = document.getElementById('soulforge-canvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + sx, clientY: rect.top + sy, button: 2, bubbles: true
    }));
  }

  function moveMouse(sx, sy) {
    const canvas = document.getElementById('soulforge-canvas');
    const rect = canvas.getBoundingClientRect();
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: rect.left + sx, clientY: rect.top + sy, bubbles: true
    }));
  }

  results.steps.push(snap('start'));

  // Step 1: Cast Mana Bolt 3 times toward enemy (right-click)
  return new Promise(resolve => {
    rightClick(640, 616);
    setTimeout(() => {
      results.steps.push(snap('after Mana Bolt #1'));
      setTimeout(() => {
        rightClick(640, 616);
        setTimeout(() => {
          results.steps.push(snap('after Mana Bolt #2'));
          setTimeout(() => {
            // Step 2: Move mouse, cast Lightning Beam (key 3)
            moveMouse(640, 616);
            pressKey('3');
            setTimeout(() => {
              results.steps.push(snap('after Lightning Beam'));
              setTimeout(() => {
                // Step 3: Cast Frost Nova (key 2) — self nova
                pressKey('2');
                setTimeout(() => {
                  results.steps.push(snap('after Frost Nova'));
                  setTimeout(() => {
                    results.final = snap('final');
                    resolve(JSON.stringify(results));
                  }, 1500);
                }, 200);
              }, 1500);
            }, 200);
          }, 600);
        }, 500);
      }, 500);
    }, 200);
  });
})()
