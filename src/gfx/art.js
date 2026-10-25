// Тяжёлые данные графики (здания, персонажи, окружение) лежат в сборке СТРОКОЙ и разбираются
// при первом обращении: парсинг 4 МБ JSON при старте игры заметно быстрее, чем вычисление
// таких же литералов интерпретатором, а ненужные картинки не разбираются вовсе.
//   G.art.data('house' | 'chars' | 'env') → объект данных (null, если файла нет)
G.art = (() => {
  const cache = {};
  const str = () => (G.ART_STR || (G.ART_STR = {}));
  function data(name) {
    if (Object.hasOwn(cache, name)) return cache[name];
    const s = str()[name];
    try { cache[name] = s ? JSON.parse(s) : null; } catch (_) { cache[name] = null; }
    return cache[name];
  }
  return { data, has: (name) => !!str()[name], clear() { for (const k of Object.keys(cache)) delete cache[k]; } };
})();
