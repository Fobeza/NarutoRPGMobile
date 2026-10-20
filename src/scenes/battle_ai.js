// ИИ противника в бою «Дуэль шиноби»: какие приёмы допустимы, какой выбрать, что показать игроку.
// Вынесено из scenes/battle.js — выбор хода врага не зависит от состояний и отрисовки, ему нужны только
// бойцы, арена и данные противника. Поведение не изменилось (проверяется tools/node/golden.js).
//
// C — контекст боя: { P, E, ed, traps, dist, has, canStand, sgn, rnd, Hh }
//   ed — данные противника (уже с поправкой на рост уличных врагов), Hh — G.hero.
G.battleAi = {
  make(C) {
    const P = C.P, E = C.E, ed = C.ed, traps = C.traps, Hh = C.Hh;
    const dist = C.dist, has = C.has, canStand = C.canStand, sgn = C.sgn, rnd = C.rnd;

    // ── ИИ противника ──
    function validAct(id, d) {
      const a = G.EACTS[id]; if (!a) return false;
      if (d < a.range[0] || d > a.range[1]) return false;
      if (a.jutsu && E.ch < 10) return false;
      if (a.kind === 'tai' && P.s.high && !has('climb')) return false;
      if (a.kind === 'throw' && P.s.hidden) return false;
      if (a.kind === 'move' && E.s.bound) return false;
      if (a.kind === 'move' && a.dir > 0 && !canStand(E, E.pos + sgn(E, P))) return false;
      if (a.kind === 'move' && a.dir < 0 && !canStand(E, E.pos - sgn(E, P))) return false;
      if (id === 'clones' && E.clones > 0) return false;
      if (id === 'trap' && traps.some((t) => t.owner === 'e')) return false;
      if (id === 'shadow' && P.s.bound) return false;
      if (id === 'mind' && P.s.conf) return false;
      if (id === 'taunt' && (P.s.shaken || Math.random() < 0.5)) return false;
      if ((id === 'kunai' || id === 'shuriken') && P.s.hidden) return false;
      return true;
    }
    function decide() {
      const d = dist();
      if (has('lazy') && Math.random() < 0.15) return 'yawn';
      let cand = (ed.acts || ['stand']).filter((id) => validAct(id, d));
      if (P.s.hidden) cand = cand.filter((id) => G.EACTS[id].kind !== 'throw');
      if (!cand.length) cand = ['guard'];
      const hurt = E.hp / E.hpMax;
      const w = cand.map((id) => {
        const a = G.EACTS[id]; let s = 1;
        if (a.kind === 'tai') s = d === 1 ? (ed.pref <= 1 ? 4 : 2) : 2.5;
        if (a.kind === 'throw') s = d >= 2 ? (ed.pref >= 2 ? 3.5 : 1.5) : 0.4;
        if (a.kind === 'move') s = (a.dir > 0 ? (d > ed.pref ? 3 + (has('impulsive') ? 2 : 0) : 0.2) : (d < ed.pref ? 3 : 0.2));
        if (a.jutsu) s *= 1.6;
        if (id === 'guard') s = has('defensive') ? 1.5 : (hurt < 0.35 ? 0.8 : 0.15);
        if (id === 'focus') s = E.ch < 20 ? 2 : 0.3;
        if (id === 'clones') s = 3;
        if (id === 'trap') s = 2;
        // Только новые обучающиеся соперники: повтор одного семейства три раза читается заранее.
        if(has('adaptive')&&P.advRepeat>=3){
          if(P.advStyle==='tai'&&id==='guard')s*=7;
          if(P.advStyle==='throw'&&a.kind==='move'&&a.dir>0)s*=5;
          if(P.advStyle==='nin'&&(id==='guard'||a.kind==='throw'))s*=4;
          if(P.advStyle==='guard'&&a.jutsu)s*=4;
        }
        if (E.s.prov && a.kind === 'tai') s *= 3;
        if (E.s.prov && (a.kind === 'move' && a.dir < 0 || id === 'guard')) s = 0.05;
        return s * rnd(0.7, 1.3);
      });
      let sum = w.reduce((a, b) => a + b, 0), r = Math.random() * sum;
      for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) return cand[i]; }
      return cand[0];
    }
    function plan() {
      E.plan = decide();
      E.shown = E.plan;
      if (has('deceive') && E.an <= 0 && Math.random() < 0.3) {
        const alt = (ed.acts || []).filter((id) => id !== E.plan && G.EACTS[id] && G.EACTS[id].kind !== 'move');
        if (alt.length) E.shown = alt[Math.floor(Math.random() * alt.length)];
      }
      E.plan2 = Hh.has('analyst') ? decide() : null;
    }
    const actName = (id) => id === 'yawn' ? 'Зевает' : (G.EACTS[id] || G.EACTS.stand).name;
    const actOf = (id) => id === 'yawn' ? Object.assign({}, G.EACTS.stand, { name: 'Зевает' }) : (G.EACTS[id] || G.EACTS.stand);

    return { validAct, decide, plan, actName, actOf };
  },
};
