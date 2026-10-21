// Система заданий: состояние в G.state.quests, отслеживаемое — G.state.tracked.
// События (G.events 'quest'): ('new', id) ('step', id, stepText) ('done', id) ('fail', id)
G.quests = (() => {
  const Q = () => G.QUESTS;
  const S = () => G.state.quests || (G.state.quests = {});
  const emit = (...a) => G.events.emit('quest', ...a);

  const api = {
    state(id) { return S()[id]; },
    active(id) { const s = S()[id]; return !!s && s.st === 'active'; },
    done(id) { const s = S()[id]; return !!s && s.st === 'done'; },
    def(id) { return Q()[id]; },
    curStep(id) { const s = S()[id], d = Q()[id]; return s && s.st === 'active' && d ? d.steps[s.step] : null; },
    list() { return Object.keys(S()).filter((id) => Q()[id]); },
    activeList() {
      const order = ['story', 'academy', 'friend', 'errand', 'secret'];
      return this.list().filter((id) => this.active(id)).sort((a, b) => order.indexOf(Q()[a].cat) - order.indexOf(Q()[b].cat));
    },

    start(id) {
      if (S()[id] || !Q()[id]) return false;
      const d = Q()[id], day = G.state.vars.day;
      S()[id] = { st: 'active', step: 0, day, due: d.deadline != null ? day + d.deadline : null };
      if (!G.state.tracked || !this.active(G.state.tracked) || d.cat === 'story') G.state.tracked = id;
      emit('new', id);
      this.check();
      return true;
    },

    // Выполнить шаг stepId (если он текущий) или текущий шаг (если stepId не указан)
    step(id, stepId) {
      const s = S()[id], d = Q()[id];
      if (!s || s.st !== 'active') return false;
      const cur = d.steps[s.step];
      if (!cur) return false;
      if (stepId && cur.id !== stepId) {
        // шаг впереди — пропустить до него (например, игрок сделал всё в другом порядке)
        const i = d.steps.findIndex((x) => x.id === stepId);
        if (i < s.step || i < 0) return false;
        s.step = i;
      }
      const current = d.steps[s.step];
      if (!this.hasNeeded(current)) return false;
      if (current.consume) for (const [item, n] of Object.entries(current.need || {})) G.game.take(item, n);
      G.state.flags[`q_${id}_${current.id}`] = 1;
      s.step++;
      if (s.step >= d.steps.length) this.complete(id);
      else { emit('step', id, d.steps[s.step - 1].text); this.check(); }
      return true;
    },

    complete(id) {
      const s = S()[id], d = Q()[id];
      s.st = 'done'; s.doneDay = G.state.vars.day;
      G.audio.sfx.questDone();
      G.state.flags['q_' + id] = 1;
      const r = d.reward || {};
      if (r.money) G.game.earn(r.money);
      for (const [k, v] of Object.entries(r.vars || {})) {
        if (k.startsWith('friend_')) G.friends.add(k.slice(7), v, 'quest');   // через общую систему: бонусы и награды уровней
        else G.state.vars[k] = (G.state.vars[k] || 0) + v;
      }
      G.game.note(`${G.QUEST_CATS[d.cat].icon} ${d.title}`);
      if (G.state.tracked === id) G.state.tracked = this.activeList()[0] || null;
      emit('done', id);
    },

    fail(id) {
      const s = S()[id];
      if (!s || s.st !== 'active') return;
      s.st = 'failed';
      if (G.state.tracked === id) G.state.tracked = this.activeList()[0] || null;
      emit('fail', id);
    },

    track(id) { if (this.active(id)) G.state.tracked = id; },
    tracked() { const t = G.state.tracked; return t && this.active(t) ? t : null; },

    // Доступен ли шаг сейчас по времени
    timeOk(step, min = G.state.vars.min) {
      if (!step || !step.time) return true;
      const [a, b] = step.time;
      return (min >= a && min < b) || (min + 1440 >= a && min + 1440 < b);
    },

    // Автоматические шаги: «есть предметы»
    check() {
      for (const id of this.activeList()) {
        const st = this.curStep(id);
        if (st && st.have && Object.entries(st.have).every(([k, n]) => G.game.count(k) >= n)) this.step(id, st.id);
      }
    },
    // Вход в здание
    onEnterMap(m) {
      const tpl = m.building && m.building.tplId;
      if (!tpl) return;
      for (const id of this.activeList()) {
        const st = this.curStep(id);
        if (st && st.reach && st.target.building === tpl) this.step(id, st.id);
      }
    },
    // Сон: шаг «лечь спать», провал просроченных
    onSleep(newDay) {
      for (const id of this.activeList()) {
        const st = this.curStep(id);
        if (st && st.target.obj === 'futon') this.step(id, st.id);
      }
      for (const id of this.activeList()) { const s = S()[id]; if (s.due != null && newDay > s.due) this.fail(id); }
    },

    // Какой сценарий запустить при разговоре с NPC (задания важнее обычных реплик)
    hasNeeded(step) { return Object.entries(step.need || {}).every(([id, n]) => G.game.count(id) >= n); },
    scriptFor(npcId) {
      for (const id of this.activeList()) {
        const st = this.curStep(id);
        if (st && st.script && st.target.npc === npcId && this.timeOk(st)) return this.hasNeeded(st) ? st.script : 'quest_missing_items';
      }
      for (const [id, d] of Object.entries(Q())) {
        if (d.offer && d.offer.npc === npcId && !S()[id] && d.offer.when()) return d.offer.script;
      }
      return null;
    },

    // Значок над NPC: '!' — есть задание, '?' — можно сдать/продвинуть, null
    iconFor(npcId) {
      for (const id of this.activeList()) {
        const st = this.curStep(id);
        if (st && st.target.npc === npcId && !st.have) return '?';
      }
      for (const [id, d] of Object.entries(Q())) {
        if (d.offer && d.offer.npc === npcId && !S()[id] && d.offer.when()) return '!';
      }
      return null;
    },

    dayName(day) { return G.game.dayName(day); },
  };
  return api;
})();

// ---------- Сценарии ----------
// call quest start id | call step id [stepId] | call qfail id
G.script.actions.quest = (a) => { if (a[0] === 'start') G.quests.start(a[1]); };
G.script.actions.step = (a) => G.quests.step(a[0], a[1]);
G.script.actions.qfail = (a) => G.quests.fail(a[0]);
G.script.actions.take = (a) => G.game.give(a[0], -(Number(a[1]) || 1));
// Условия: quest.id (активно), quest.id.step (текущий шаг), qdone.id (выполнено), has.item.n
G.script.extraTest = (cond) => {
  let m;
  if ((m = cond.match(/^quest\.(\w+)(?:\.(\w+))?$/))) {
    if (!G.quests.active(m[1])) return false;
    return !m[2] || (G.quests.curStep(m[1]) || {}).id === m[2];
  }
  if ((m = cond.match(/^qdone\.(\w+)$/))) return G.quests.done(m[1]);
  if ((m = cond.match(/^has\.(\w+)(?:\.(\d+))?$/))) return G.game.count(m[1]) >= Number(m[2] || 1);
  return undefined;
};
// Предметы меняются → проверить шаги «есть предметы»
G.events.on('inv', () => G.quests.check());
