// Phase 3 Devour test
// 1. Cast Mana Bolt toward closest enemy until it dies
// 2. Walk player to the essence shard location (auto-devour)
// 3. Verify devour count increased and atom unlocked
// 4. Check Voice of the World notification appeared

(() => {
  const results = {};

  function snap(label) {
    return {
      label,
      hp: document.getElementById('hud-hp')?.textContent,
      enemies: document.getElementById('hud-enemies')?.textContent,
      devourCount: document.getElementById('hud-devour-count')?.textContent,
      unlocked: document.getElementById('hud-unlocked')?.textContent,
      devourCd: document.getElementById('hud-devour-cd')?.textContent,
      voiceVisible: document.getElementById('hud-voice')?.style.display,
      voiceText: document.getElementById('hud-voice')?.textContent,
      tile: document.getElementById('hud-tile')?.textContent
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

  results.start = snap('start');

  // Step 1: Cast Mana Bolt 3 times toward closest enemy at (640, 616)
  return new Promise(resolve => {
    rightClick(640, 616);
    setTimeout(() => {
      results.afterBolt1 = snap('after bolt 1');
      setTimeout(() => {
        rightClick(640, 616);
        setTimeout(() => {
          results.afterBolt2 = snap('after bolt 2');
          setTimeout(() => {
            rightClick(640, 616);
            setTimeout(() => {
              results.afterBolt3 = snap('after bolt 3');
              // Step 2: Walk south to devour essence shard
              pressKey('s');
              setTimeout(() => {
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 's', bubbles: true }));
                setTimeout(() => {
                  results.afterWalk = snap('after walk south');
                  // Wait for auto-devour
                  setTimeout(() => {
                    results.afterDevour = snap('after auto-devour');
                    // Check console for Voice of the World message
                    resolve(JSON.stringify(results));
                  }, 1000);
                }, 1500);
              }, 100);
            }, 600);
          }, 600);
        }, 600);
      }, 600);
    }, 200);
  });
})()
