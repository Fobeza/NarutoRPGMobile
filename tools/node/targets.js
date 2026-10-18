// Общий доступ к целевым окнам побед (tools/targets.json).
// Им пользуются tools/node/checks.js (проверка) и tools/node/balance.js (генератор документации).
'use strict';
const fs = require('fs');
const path = require('path');

const TARGETS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'targets.json'), 'utf8'));

// Окно [мин, макс] для сценария и сборки. Сценарий может задавать либо одно окно на все сборки,
// либо отдельные по сборкам (причины — в notes внутри targets.json).
function target(scen, build) {
  const t = (TARGETS.targets && TARGETS.targets[scen]) || TARGETS.default;
  if (Array.isArray(t)) return t;
  return t[build] || t.default || TARGETS.default;
}

// Короткая подпись окна для вывода: «45–80%»
function label(scen, build) {
  const [lo, hi] = target(scen, build);
  return Math.round(lo * 100) + '–' + Math.round(hi * 100) + '%';
}

module.exports = { TARGETS, target, label };
