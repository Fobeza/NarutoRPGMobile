// Окно ввода/копирования кода сохранения — обычный DOM-элемент поверх игры (iOS даёт в нём копировать и вставлять).
// Используется в «Сохранение…» (экспорт, импорт) и на титульном экране («Загрузить игру»).
//   G.codeBox.open({ title, text, readonly, okLabel, hint, onOk(ta, close) })
//   G.codeBox.isOpen — пока окно открыто, сцены не обрабатывают ввод
//   G.codeBox.hintErr(текст) — красная подсказка (код не подошёл)
G.codeBox = (() => {
  let open = false;
  const $ = (id) => document.getElementById(id);
  function show({ title, text, readonly, okLabel, hint, onOk }) {
    const box = $('code-box'), ta = $('cb-text');
    $('cb-title').textContent = title;
    $('cb-hint').textContent = hint || '';
    $('cb-hint').className = 'te-hint';
    const ok = $('cb-ok');
    ok.textContent = okLabel;
    ta.value = text || ''; ta.readOnly = !!readonly;
    box.classList.remove('hidden'); open = true;
    const close = () => { box.classList.add('hidden'); open = false; ta.blur(); G.input.consume(); };
    ok.onpointerdown = (e) => { e.preventDefault(); onOk(ta, close); };
    $('cb-cancel').onpointerdown = (e) => { e.preventDefault(); close(); };
    setTimeout(() => { if (readonly) { ta.focus(); ta.select(); } else ta.focus(); }, 50);
  }
  const hintErr = (t) => { const h = $('cb-hint'); h.textContent = t; h.className = 'te-hint err'; };
  return { open: show, hintErr, get isOpen() { return open; } };
})();
