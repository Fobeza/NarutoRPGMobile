// Переходы из мира в «большие» сцены (бой, тренировки, уроки, события) — по G.game.pending = { type, ... }
G.flow = {
  battle(a, world) {
    G.scenes.push(G.scenes.make('battle', a, (res) => {
      G.state.vars.lastwin = res.win ? 1 : 0;
      G.events.emit('battle', a, res);
      if (a.onEnd) a.onEnd(res, world);
      const next = res.win ? a.win : (a.lose || a.win);
      if (next) world.talk(next);
      else if (!res.win && a.mode === 'ko' && !a.onEnd) world.faint && world.faint('beaten');
    }));
  },
};
