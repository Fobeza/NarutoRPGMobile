// Персонажи: общий API. Описания внешности — data/characters.js (G.chars.DEFS, G.chars.STY),
// отрисовка спрайтов и портретов — gfx/chars_render.js (sheet, draw, portrait).
// Кадр 16×20 логических пикселей (32×40 реальных). Направления: down, left, right (зеркало left), up.
G.chars = (() => {
  const DEFS = {};      // id → { name, hair, band?, marks?, skin?: [кожа, тень], colors: { h,H волосы; t,T верх; a акцент; p,P низ; f обувь; e глаза; b,B протектор } }
  const STY = {};       // id → { top, sleeve, ex: [детали], hair?, body?, kid?, eye?, cat?, dog? }
  const DIRS = ['down', 'left', 'right', 'up'];
  const FW = 16, FH = 20;
  const WALK = [1, 0, 2, 0];   // анимация ходьбы: кадры листа
  function nameOf(id) {
    const d = DEFS[id];
    return d ? G.util.fmt(d.name, { name: G.state.hero.name }) : id;
  }
  return { DEFS, STY, DIRS, FW, FH, WALK, nameOf };
})();
