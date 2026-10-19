// Пролог: тьма и голоса — героя нашли без сознания. После реплик — палата больницы (скрипт hosp_wake).
G.scenes.register('prologue', () => {
  let t = 0;
  return {
    name: 'prologue',
    enter() {
      G.dialog.start('prologue_voices', {
        bottom: 30,
        onEnd: () => G.scenes.fadeTo(G.scenes.make('world', Object.assign(G.world.startPos(), { intro: 'hosp_wake' })), 1.5),
      });
    },
    update(dt) { t += dt; },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H;
      ctx.fillStyle = '#06050c'; ctx.fillRect(0, 0, W, H);
      // свет сквозь веки: тусклые полосы, медленно дышат
      for (let i = 0; i < 5; i++) {
        const a = 0.05 + 0.04 * Math.sin(t * 0.9 + i * 1.3), y = Math.floor(H * (0.2 + i * 0.12));
        ctx.fillStyle = '#c8b890'; ctx.globalAlpha = a; ctx.fillRect(0, y, W, 2 + (i % 2));
      }
      ctx.globalAlpha = 1;
    },
  };
});
