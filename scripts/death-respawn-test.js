// Test: walk player into an enemy to take damage and die, then respawn with R
(() => {
  const results = {};
  results.startHp = document.getElementById('hud-hp')?.textContent;
  results.startEnemies = document.getElementById('hud-enemies')?.textContent;
  
  // Hold S key (move down) for 3 seconds — should walk toward the enemy at (14,14)
  window.dispatchEvent(new KeyboardEvent('keydown', {key: 's', bubbles: true}));
  
  // Sample HP every 500ms
  const samples = [];
  const sampleInterval = setInterval(() => {
    samples.push({
      t: samples.length * 0.5,
      hp: document.getElementById('hud-hp')?.textContent,
      tile: document.getElementById('hud-tile')?.textContent
    });
  }, 500);
  
  // After 4 seconds: release S, check if dead, then respawn
  return new Promise(resolve => {
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', {key: 's', bubbles: true}));
      clearInterval(sampleInterval);
      results.samples = samples;
      results.endHp = document.getElementById('hud-hp')?.textContent;
      results.endTile = document.getElementById('hud-tile')?.textContent;
      
      // If dead, press R to respawn
      if (results.endHp === 'DEAD') {
        setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', {key: 'r', bubbles: true}));
          window.dispatchEvent(new KeyboardEvent('keyup', {key: 'r', bubbles: true}));
          setTimeout(() => {
            results.afterRespawn = {
              hp: document.getElementById('hud-hp')?.textContent,
              tile: document.getElementById('hud-tile')?.textContent,
              enemies: document.getElementById('hud-enemies')?.textContent
            };
            resolve(JSON.stringify(results));
          }, 500);
        }, 500);
      } else {
        resolve(JSON.stringify(results));
      }
    }, 4000);
  });
})()
