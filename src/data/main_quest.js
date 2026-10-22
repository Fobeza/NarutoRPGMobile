// Главная ветка «Фиолетовая чакра»: постоянная, каждый шаг — механика мира и кусочек истории.
// Шаг: day — не раньше дня; on: [событие мира, фильтр] — закрывается действием игрока (см. G.quests.notify);
// intro — сцена, когда шаг открылся; after — сцена после шага. Сюжет и порядок — docs/STORY.md.
const _mqTrain = (...ids) => ['training', (id) => ids.includes(id)];
G.QUESTS.main = {
  cat: 'story', title: 'Фиолетовая чакра',
  desc: 'Твоя чакра необычная: фиолетовая, сильная и непослушная. Рано или поздно ею кто-то заинтересуется. Нужно научиться держать её и постоять за себя, пока этого не случилось.',
  steps: [
    { id: 'dummy', day: 2, text: 'Попробовать удар по манекену на полигоне', target: { building: 'training_ground' }, on: _mqTrain('dummy', 'log', 'throw'), intro: 'mq_dummy_intro', after: 'mq_dummy_after' },
    { id: 'library', day: 3, text: 'Найти в библиотеке книгу о чакре', target: { building: 'library' }, on: _mqTrain('library'), intro: 'mq_library_intro', after: 'mq_library_after' },
    { id: 'rod', day: 4, text: 'Купить удочку в сувенирной лавке (80 рё)', target: { building: 'souvenir' }, have: { fishing_rod: 1 }, intro: 'mq_rod_intro' },
    { id: 'fish', day: 4, text: 'Порыбачить у реки или на пирсе', target: { building: 'pier' }, on: ['fished'], after: 'mq_fish_after' },
    { id: 'falls', day: 5, text: 'Помедитировать у водопада', target: { building: 'waterfall' }, on: _mqTrain('falls'), intro: 'mq_falls_intro', after: 'mq_falls_after' },
    { id: 'shop', day: 6, text: 'Купить в лавке кунаи или бинты', target: { building: 'weapons' }, on: ['bought', (id) => ['kunai', 'shuriken', 'bandage'].includes(id)], intro: 'mq_shop_intro' },
    { id: 'job', day: 7, text: 'Взять поручение с доски', target: { building: 'hokage_tower' }, on: ['job'], after: 'mq_job_after' },
    { id: 'roof', day: 8, text: 'Подняться на крышу (у стены дома — A)', target: { building: 'academy' }, on: ['roof'], when: () => !!G.state.flags.roofs, after: 'mq_roof_after' },
    { id: 'spar', day: 11, text: 'Провести учебный спарринг (меню общения)', target: { building: 'academy' }, on: ['battle', (a) => a && a.mode === 'spar'], intro: 'mq_spar_intro', after: 'mq_spar_after' },
    { id: 'more', day: 12, text: 'Продолжай учиться, тренироваться и дружить. Продолжение — скоро.', target: { building: 'academy' }, when: () => false },
  ],
  reward: { text: 'Готов постоять за себя' },
};
