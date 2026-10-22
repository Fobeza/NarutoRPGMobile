// Главная ветка «Фиолетовая чакра»: постоянная, каждый шаг — механика мира и кусочек истории.
// Шаг: day — не раньше дня; when — условие; on: [событие мира, фильтр] — закрывается действием игрока (G.quests.notify);
// reach — достаточно войти в здание; script — сцена при разговоре с target.npc; intro — сцена, когда шаг открылся; after — сцена после шага.
// Сюжет и порядок — docs/STORY.md. Выборы с последствиями — systems/choices.js, экзамен — systems/exam.js.
const _mqTrain = (...ids) => ['training', (id) => ids.includes(id)];
G.QUESTS.main = {
  cat: 'story', title: 'Фиолетовая чакра',
  desc: 'Твоя чакра необычная: фиолетовая, сильная и непослушная. Рано или поздно ею кто-то заинтересуется. Нужно научиться держать её и постоять за себя, пока этого не случилось.',
  steps: [
    // ── неделя 1: «Чужой» ──
    { id: 'dummy', day: 2, text: 'Попробовать удар по манекену на полигоне', target: { building: 'training_ground' }, on: _mqTrain('dummy', 'log', 'throw'), intro: 'mq_dummy_intro', after: 'mq_dummy_after' },
    { id: 'library', day: 3, text: 'Найти в библиотеке книгу о чакре', target: { building: 'library' }, on: _mqTrain('library'), intro: 'mq_library_intro', after: 'mq_library_after' },
    { id: 'rod', day: 4, text: 'Купить удочку в сувенирной лавке (80 рё)', target: { building: 'souvenir' }, have: { fishing_rod: 1 }, intro: 'mq_rod_intro' },
    { id: 'fish', day: 4, text: 'Порыбачить у реки или на пирсе', target: { building: 'pier' }, on: ['fished'], after: 'mq_fish_after' },
    { id: 'falls', day: 5, text: 'Помедитировать у водопада', target: { building: 'waterfall' }, on: _mqTrain('falls'), intro: 'mq_falls_intro', after: 'mq_falls_after' },
    { id: 'shop', day: 6, text: 'Купить в лавке кунаи или бинты', target: { building: 'weapons' }, on: ['bought', (id) => ['kunai', 'shuriken', 'bandage'].includes(id)], intro: 'mq_shop_intro' },
    { id: 'job', day: 7, text: 'Взять поручение с доски', target: { building: 'hokage_tower' }, on: ['job'], after: 'mq_job_after' },
    { id: 'roof', day: 8, text: 'Подняться на крышу (у стены дома — A)', target: { building: 'academy' }, on: ['roof'], when: () => !!G.state.flags.roofs, after: 'mq_roof_after' },
    // ── неделя 2: «Контроль» ──
    { id: 'tree', day: 9, text: 'Потренировать хождение по дереву на полигоне №3', target: { building: 'training_3' }, on: _mqTrain('tree'), when: () => !!G.state.flags.tech_tree, intro: 'mq_tree_intro', after: 'mq_tree_after' },
    { id: 'checkup1', day: 10, text: 'Пройти осмотр в больнице', target: { building: 'hospital' }, reach: true, intro: 'mq_checkup1_intro', after: 'mq_checkup1_after' },
    { id: 'spar', day: 11, text: 'Провести учебный спарринг (меню общения)', target: { building: 'academy' }, on: ['battle', (a) => a && a.mode === 'spar'], intro: 'mq_spar_intro', after: 'mq_spar_after' },
    { id: 'taunt', day: 13, text: 'Дождаться вечера: у калитки тебя ждут', target: { building: 'hero_home' }, on: ['choice', (id) => id === 'taunt'], intro: 'mq_taunt' },
    { id: 'water', day: 14, text: 'Потренировать хождение по воде на озере', target: { tile: [138, 104], label: 'Берег озера' }, on: _mqTrain('water'), when: () => !!G.state.flags.tech_water, intro: 'mq_water_intro', after: 'mq_water_after' },
    // ── неделя 3: «Экзамен» ──
    { id: 'dream', day: 15, text: 'Выспаться: что-то снилось этой ночью', target: { building: 'hero_home' }, on: ['scene', (id) => id === 'mq_dream'], intro: 'mq_dream' },
    { id: 'brief', day: 15, text: 'Поговорить с Ирукой об экзамене', target: { npc: 'iruka', in: 'academy' }, script: 'mq_exam_brief' },
    { id: 'bunshin', day: 16, text: 'Выучить Буншин на уроке в Академии', target: { building: 'academy' }, on: ['lesson', (p) => p && p.learn === 'bunshin'], after: 'mq_bunshin_after' },
    { id: 'study', day: 17, text: 'Подготовиться к письменному тесту: чтение дома или в библиотеке', target: { building: 'library' }, on: _mqTrain('library', 'book'), intro: 'mq_study_intro' },
    { id: 'help', day: 17, text: 'Подарить подарок другу: друзья — твоя защита', target: { building: 'academy' }, on: ['gift'], after: 'mq_help_after' },
    { id: 'lee', day: 18, text: 'Размяться на полигоне перед экзаменом', target: { building: 'training_ground' }, on: _mqTrain('dummy', 'log', 'run', 'throw'), intro: 'mq_lee_intro', after: 'mq_lee_after' },
    { id: 'checkup2', day: 19, text: 'Пройти вторую проверку в больнице', target: { building: 'hospital' }, reach: true, after: 'mq_checkup2_after' },
    { id: 'hokage', day: 20, text: 'Зайти к Хокаге в Резиденцию', target: { npc: 'hokage', in: 'hokage_tower' }, script: 'mq_hokage_talk' },
    { id: 'exam', day: 21, text: 'Сдать экзамен на генина в Академии (воскресенье, 21 июня)', target: { building: 'academy' }, on: ['exam', (pass) => !!pass], when: () => G.exam.open(), intro: 'mq_exam_day' },
    // ── после экзамена ──
    { id: 'gate', day: 21, text: 'Подойти к воротам: теперь тебя выпустят', target: { building: 'gate' }, reach: true, after: 'mq_gate_after' },
    { id: 'more', day: 22, text: 'Продолжение истории — скоро. Пока гуляй, тренируйся, дружи и выполняй поручения.', target: { building: 'academy' }, when: () => false },
  ],
  reward: { text: 'Готов постоять за себя' },
};
