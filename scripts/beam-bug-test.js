// Beam lifetime bug verification
// 1. Note player position before cast
// 2. Cast Lightning Beam (slot 3) toward bottom
// 3. Wait 100ms — beam should still be visible (lifetime 150ms)
// 4. Wait 500ms — beam should be gone
// 5. Move player far away from cast position
// 6. Verify NO beam VFX remains at the original cast location

(() => {
  const results = {};

  function getBeamVfxCount() {
    // Count Graphics children in the world container that have line drawings
    // Beams are added directly to the worldContainer.entities container
    const worldContainer = window.__soulforge.worldContainer;
    const entitiesContainer = worldContainer.children[1]; // Entities container
    let beamCount = 0;
    for (const child of entitiesContainer.children) {
      // Beam Graphics don't have a label starting with Player/Enemy/Projectile
      if (child.label && child.label.startsWith('Beam')) {
        beamCount++;
      }
      // Also count unlabeled Graphics that have geometry
      if (!child.label && child.graphicsData) {
        beamCount++;
      }
    }
    return beamCount;
  }

  function getPlayerPos() {
    return document.getElementById('hud-pixel')?.textContent;
  }

  results.playerPosBefore = getPlayerPos();
  results.beamsBefore = getBeamVfxCount();

  // Cast Lightning Beam toward bottom of screen
  const canvas = document.getElementById('soulforge-canvas');
  const rect = canvas.getBoundingClientRect();
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 640, clientY: rect.top + 616, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: '3', bubbles: true }));

  return new Promise(resolve => {
    setTimeout(() => {
      results.beams100ms = getBeamVfxCount(); // should still be visible (lifetime 150ms)
      setTimeout(() => {
        results.beams500ms = getBeamVfxCount(); // should be 0 (despawned)
        // Now move player far away
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
        setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true }));
          results.playerPosAfter = getPlayerPos();
          setTimeout(() => {
            results.beamsAfterMove = getBeamVfxCount(); // should still be 0
            resolve(JSON.stringify(results));
          }, 500);
        }, 1500);
      }, 500);
    }, 100);
  });
})()
