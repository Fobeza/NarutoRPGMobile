// Палитра игры (~32 цвета). Тёплая Коноха.
G.PAL = {
  black: '#14121c', ink: '#2a2030', dark: '#3a3548', gray: '#6c6680', light: '#b8b0cc', white: '#f8f4ec',
  paper: '#f4ecd8', paperDark: '#d8cbb0',
  orange: '#e8621a', orangeDark: '#a8420c', orangeLight: '#ff9a4a',
  red: '#c8401c', redDark: '#8a2a10',
  yellow: '#ffd23a', yellowDark: '#d89a1a',
  skin: '#f6c89a', skinShade: '#d89a6a', skinDark: '#c88a5a',
  grass: '#5aa046', grassDark: '#3e7a34', grassLight: '#7cc05a',
  leaf: '#2e6a32', leafDark: '#1e4a26', trunk: '#7a4a2a', trunkDark: '#5a321a',
  path: '#d8b67a', pathDark: '#b8945a', pathLight: '#ecd29a',
  water: '#3a8ad0', waterDark: '#2a62a0', waterLight: '#7ac0f0',
  wood: '#a8683a', woodDark: '#7a4626', roof: '#b84a3a', roofDark: '#8a3226',
  stone: '#9a9aa8', stoneDark: '#6a6a7a',
  blue: '#2a4a9a', blueDark: '#1a2e6a', navy: '#1e2a4a',
  green: '#3a7a4a', greenDark: '#26543a', vest: '#5a7a3a', vestDark: '#3e5a28',
  pink: '#f0a0c0', pinkDark: '#c8708e', purple: '#7a5aa0', purpleDark: '#54386e',
  brown: '#6a4226', brownDark: '#4a2a16', hairBlack: '#2a2a3a', hairBlackHi: '#46466a',
};

// Токены интерфейса «Б. Лак и сталь»: панели, кромки, текст на панелях.
// Сцены рисуют текст на панелях только через эти токены — тема меняется в одном месте.
G.UI = {
  panel: '#201d28', panelHi: '#34313e', panelLo: '#14121c',   // основная панель: лак
  deep: '#17151d', deepHi: '#26232e', deepLo: '#0b0a10',      // заглублённая (тосты, HUD)
  edge: '#6a6a7a', edgeDim: '#46444f',                        // стальная кромка
  text: '#dcd8e8', dim: '#8a86a0', faint: '#54506a',          // текст / приглушённый / блокированный
  sel: '#34313e', selText: '#f8f4ec',                         // строка под курсором
  ok: '#7ac06a', err: '#ff6a5a',                              // успех / ошибка
};
