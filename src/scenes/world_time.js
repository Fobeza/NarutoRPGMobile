// Сцена мира, часть «Время»: «Подождать», события по часам, обмороки, дорога домой, сон и новый день.
// Методы подмешиваются в объект сцены (scenes/world.js: G.worldParts); this — сама сцена.
// K — общие константы сцены: тайл, высота шапки и нижней полосы, объекты, за которыми герой просвечивает.
G.worldParts = G.worldParts || [];
G.worldParts.push(({ T, HUD_H, STRIP_H, FADE_BEHIND }) => ({
    // ---------- «Подождать» (меню паузы) ----------
    // Часы идут минута за минутой — так усталость, лавки, прогулы, урок и сюжет срабатывают
    // ровно как в обычной игре, а не «перепрыгивают» час. Ожидание бесплатным не бывает:
    // advance начисляет усталость. Возвращает, сколько минут действительно прошло.
    waitWhy() {
      if (this.cine) return 'Идёт сцена';
      if (G.state.daily.lessonRun) return 'Идёт урок';
      if (G.game.pending) return 'Идёт сцена';
      if (G.scenes.busy) return 'Идёт переход';
      return null;
    },
    // Что предложить в окне «Подождать»: одно и то же в игре и в кадрах проверки.
    waitSpec() {
      const min = G.state.vars.min, evening = 18 * 60, toEvening = evening - min;
      return {
        title: 'ПОДОЖДАТЬ',
        text: 'Часы идут как обычно: усталость растёт, события могут прервать.',
        options: [
          { label: '15 минут', sub: G.game.clock(min + 15), min: 15 },
          { label: '1 час', sub: G.game.clock(min + 60), min: 60 },
          { label: 'До вечера', sub: toEvening > 0 ? G.game.clock(evening) : 'уже вечер', min: Math.max(0, toEvening), off: toEvening > 0 ? null : 'Вечер уже наступил' },
        ],
      };
    },
    skipTime(n) {
      const v = G.state.vars, total = Math.max(0, Math.round(n));
      if (!total || this.waitWhy()) return 0;
      let passed = 0, cut = false;
      for (let left = total; left > 0; left--) {
        const before = v.min;
        G.game.advance(1);
        passed++;
        this.onTime(before, v.min);
        // сцена/обморок/событие перехватили ход — дальше время пойдёт своим чередом
        if (G.scenes.top() !== this || G.scenes.busy || G.game.pending || this.pendingTalk) { cut = true; break; }
        if (G.story && G.story.poll(this)) { cut = true; break; }
      }
      if (!cut) {
        this.softRefresh();
        this.showToast(`⌛ Ждали ${passed} мин · ${G.game.clock(v.min)}`);
        G.audio.sfx.select();
      }
      return passed;
    },

    // ---------- Время: события по часам ----------
    onTime(prev, now) {
      const v = G.state.vars, m = this.map, d = G.state.daily;
      const crossed = (t) => prev < t && now >= t;
      const every = (k) => Math.floor(prev / k) !== Math.floor(now / k);
      if (every(10)) this.softRefresh();
      if (every(120) && G.state.started) G.storage.save(G.state);          // автосейв раз в 2 часа
      // подсказки онбординга
      if (m.outdoor) this.tip('clock', '⏰ Время — за дела', 'Часы идут, пока ты идёшь или чем-то занят. Стоишь — время стоит. Ждать: Меню → Подождать');
      if (m.outdoor && G.life.raining()) this.tip('rain', '☂ Дождь', 'Многие сидят по домам');
      if (crossed(19 * 60)) this.tip('evening', '🌙 Вечер', 'Лавки закрываются в 19–23 часа. Смотри часы на карте');
      // лавка закрывается
      const shop = m.building && G.SHOPS[m.building.tplId];
      if (shop && crossed(shop.hours[1] - 15)) this.showToast('Лавка закроется через 15 минут');
      if (shop && crossed(shop.hours[1])) this.showToast('Лавка закрылась');
      // нужды
      if (v.fatigue > 80 && !d.tired) { d.tired = 1; this.showToast('Ты устал... Пора отдохнуть'); this.tip('fatigue', '😓 Усталость', 'Еда и отдых снимают усталость: Ичираку, данго-лавка или дома (рис бесплатно)'); }
      if (v.fatigue >= 100) return this.faint('tired');
      // ночь
      if (crossed(22 * 60)) this.tip('night', '🌙 Поздно', 'С 23:00 ученикам нельзя на улицу — патруль отправит домой');
      if (crossed(23 * 60) && m.outdoor) { this.notes.push({ title: '🌙 Комендантский час', text: 'Ученикам пора по домам!', col: '#9ab0ff', t: 3 }); G.audio.sfx.error(); }
      if (now >= 26 * 60) return this.faint('late');
      if (m.outdoor && now >= 23 * 60 + 30 && every(10) && Math.random() < 0.6) this.talk('patrol_curfew');   // патруль надёжный: комендантский час — не пустая угроза
    },

    // Обморок: от усталости днём — больница, поздно ночью — сон где стоишь
    faint(kind) {
      const v = G.state.vars;
      if ((kind === 'tired' || kind === 'beaten') && v.min < 21 * 60) {
        G.scenes.fadeOut(() => {
          const hb = G.world.konoha().buildings.find((b) => b.tplId === 'hospital');
          if (hb && hb.interior) this.setMap({ map: hb.interior.id, entry: true });
          G.game.advance(180);
          v.fatigue = 65;
          G.game.note('Обморок от усталости — очнулся в больнице');
          this.pendingTalk = 'faint_hospital';
        }, 1.2);
      } else {
        G.game.note(kind === 'late' ? 'Уснул, не дойдя до кровати' : 'Свалился без сил');
        this.doSleep({ faint: true });
      }
    },
    // Патруль/сценарий отправляет домой
    goHome() {
      G.scenes.fadeOut(() => {
        const hm = G.world.get(G.world.heroHome().interior.id);
        this.setMap({ map: hm.id, x: 3 * 16 + 8, y: 5 * 16 + 4, dir: 'up' });
        G.game.advance(20);
      }, 2);
    },

    // ---------- Сон и новый день ----------
    doSleep(opts = {}) {
      G.scenes.fadeOut(() => {
        G.quests.onSleep(G.state.vars.day + 1);
        const sum = G.game.sleep(opts);
        const home = G.world.heroHome();
        const hm = G.world.get(home.interior.id);
        this.setMap({ map: hm.id, x: 3 * 16 + 8, y: 4 * 16 + 4, dir: 'down' });
        G.storage.save(G.state, { backup: true });   // утренняя резервная копия
        G.scenes.push(G.scenes.make('daysum', sum, () => {
          G.scenes.fadeOut(() => {
            G.scenes.pop();
            if (G.quests.done('day1') && !G.state.flags.day2_intro) { G.state.flags.day2_intro = 1; this.pendingTalk = 'day2_morning'; }
          }, 3);
        }));
      }, 2);
    },
}));
