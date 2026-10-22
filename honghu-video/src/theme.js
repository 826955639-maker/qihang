// 设计常量（CLAUDE.md §3）
export const W = 1920, H = 1080, FPS = 30, TOTAL = 5400;

export const C = {
  kraft: '#E9DCC0',
  newsprint: '#D8CFBC',
  paper: '#F6F2EA',
  red: '#B8312F',
  ink: '#1F1B18',
  grass: '#6E7B3B',
  river: '#3F6E8C',
  indigo: '#1E3A5F',
  gold: '#E6A93A',
  shadow: 'rgba(31,27,24,0.28)',
  tape: '#F3E3A0',
  night: '#1C2738',
};

export const F = {
  title: (px = 120) => `${px}px SerifB`,
  heavy: (px = 120) => `${px}px SerifH`,
  serif: (px = 36) => `${px}px SerifR`,
  sub: (px = 44) => `${px}px SansM`,
  hand: (px = 64) => `${px}px MaShan`,
};
