/* ============================================================
   data.js · 常量、工具函数、预置演示数据
   ============================================================ */
window.SH = window.SH || {};

/* ---------- 工具函数 ---------- */
SH.utils = {
  uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  todayISO() {
    return SH.utils.isoDate(new Date());
  },

  /** 本周一的日期 */
  weekStartISO() {
    const d = new Date();
    const day = d.getDay(); // 0=周日
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return SH.utils.isoDate(d);
  },

  /** 本周日 */
  weekEndISO() {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? 0 : 7 - day);
    d.setDate(d.getDate() + diff);
    return SH.utils.isoDate(d);
  },

  /** 当前月份第一天 */
  monthStartISO() {
    const d = new Date();
    d.setDate(1);
    return SH.utils.isoDate(d);
  },

  /** 相对今天偏移天数的日期（用于 seed） */
  daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return SH.utils.isoDate(d);
  },

  /** 格式化为 YYYY/MM/DD */
  fmtDate(iso) {
    if (!iso) return '';
    return iso.slice(5).replace('-', '/');
  },

  /** 金额格式化 */
  fmtMoney(n) {
    const v = Number(n) || 0;
    return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  /** 去掉 ¥ 显示纯数字 */
  fmtNum(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  },

  todayCN() {
    const d = new Date();
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`;
  }
};

/* ---------- 常量 ---------- */
SH.BILL_TYPES = [
  { value: 'rent',    label: '房租',  emoji: '🏠' },
  { value: 'elec',    label: '电费',  emoji: '💡' },
  { value: 'water',   label: '水费',  emoji: '💧' },
  { value: 'gas',     label: '燃气',  emoji: '🔥' },
  { value: 'net',     label: '网费',  emoji: '📶' },
  { value: 'daily',   label: '日用品', emoji: '🧴' },
  { value: 'dinner',  label: '聚餐',  emoji: '🍜' },
  { value: 'other',   label: '其他',  emoji: '📌' }
];

SH.SPLIT_MODES = [
  { value: 'even',  label: '均摊' },
  { value: 'head',  label: '按人头' },
  { value: 'custom',label: '自定义比例' },
  { value: 'amount',label: '自定义金额' }
];

SH.AREAS = ['客厅', '厨房', '卫生间', '卧室', '公共区', '阳台', '其他'];
SH.FREQS = ['每天', '每周', '每月'];
SH.DOW = ['日', '一', '二', '三', '四', '五', '六'];

SH.AVATAR_COLORS = ['#1f5e4d', '#c05b2d', '#2f5597', '#7c5cbf', '#b45309', '#0e7490', '#be185d', '#4d7c0f'];

/* ---------- 预置演示数据 ---------- */
SH.seed = function () {
  const today = SH.utils.todayISO();
  const roommates = [
    { id: 'r1', name: '陈默',   color: '#1f5e4d', joined: SH.utils.daysAgoISO(180) },
    { id: 'r2', name: '林小夏', color: '#c05b2d', joined: SH.utils.daysAgoISO(150) },
    { id: 'r3', name: '王远',   color: '#2f5597', joined: SH.utils.daysAgoISO(120) },
    { id: 'r4', name: '周可',   color: '#7c5cbf', joined: SH.utils.daysAgoISO(90) }
  ];

  const bills = [
    { id: 'b1', type: 'rent',   amount: 8000, payerId: 'r1', splitMode: 'even',   splitIds: ['r1','r2','r3','r4'], splitWeights: null, date: SH.utils.daysAgoISO(11), note: '9月房租' },
    { id: 'b2', type: 'net',    amount: 120,  payerId: 'r1', splitMode: 'even',   splitIds: ['r1','r2','r3','r4'], splitWeights: null, date: SH.utils.daysAgoISO(9),  note: '宽带月费' },
    { id: 'b3', type: 'elec',   amount: 486,  payerId: 'r3', splitMode: 'even',   splitIds: ['r1','r2','r3','r4'], splitWeights: null, date: SH.utils.daysAgoISO(7),  note: '' },
    { id: 'b4', type: 'water',  amount: 128,  payerId: 'r2', splitMode: 'even',   splitIds: ['r1','r2','r3','r4'], splitWeights: null, date: SH.utils.daysAgoISO(6),  note: '' },
    { id: 'b5', type: 'gas',    amount: 96,   payerId: 'r4', splitMode: 'even',   splitIds: ['r1','r2','r3','r4'], splitWeights: null, date: SH.utils.daysAgoISO(4),  note: '' },
    { id: 'b6', type: 'daily',  amount: 86,   payerId: 'r2', splitMode: 'head',   splitIds: ['r1','r2','r3','r4'], splitWeights: null, date: SH.utils.daysAgoISO(3),  note: '垃圾袋、洗洁精' },
    { id: 'b7', type: 'dinner', amount: 240,  payerId: 'r4', splitMode: 'custom', splitIds: ['r1','r2','r3','r4'], splitWeights: { r1: 3, r2: 3, r3: 2, r4: 2 }, date: SH.utils.daysAgoISO(2), note: '周末火锅' }
  ];

  const dutyTasks = [
    { id: 'd1', emoji: '🗑️', name: '倒垃圾',     freq: '每天', area: '公共区', day: null },
    { id: 'd2', emoji: '🧹', name: '客厅清扫',   freq: '每周', area: '客厅',   day: 6 },
    { id: 'd3', emoji: '🍳', name: '厨房清洁',   freq: '每周', area: '厨房',   day: 0 },
    { id: 'd4', emoji: '🚿', name: '卫生间清洁', freq: '每周', area: '卫生间', day: 6 },
    { id: 'd5', emoji: '🧼', name: '公共区拖地', freq: '每周', area: '公共区', day: 0 },
    { id: 'd6', emoji: '🪴', name: '阳台大扫除', freq: '每月', area: '阳台',   day: 1 }
  ];

  const weekStart = SH.utils.weekStartISO();
  const schedule = {
    weekStart: weekStart,
    weekEnd: SH.utils.weekEndISO(),
    assignments: { d1: 'r2', d2: 'r1', d3: 'r3', d4: 'r4', d5: 'r1', d6: 'r2' },
    done: { d1: today, d3: today },
    records: [
      { id: 'rc1',  taskId: 'd1', roommateId: 'r2', date: SH.utils.daysAgoISO(1) },
      { id: 'rc2',  taskId: 'd1', roommateId: 'r3', date: SH.utils.daysAgoISO(2) },
      { id: 'rc3',  taskId: 'd1', roommateId: 'r1', date: SH.utils.daysAgoISO(3) },
      { id: 'rc4',  taskId: 'd1', roommateId: 'r4', date: SH.utils.daysAgoISO(4) },
      { id: 'rc5',  taskId: 'd1', roommateId: 'r2', date: SH.utils.daysAgoISO(5) },
      { id: 'rc6',  taskId: 'd1', roommateId: 'r3', date: SH.utils.daysAgoISO(6) },
      { id: 'rc7',  taskId: 'd2', roommateId: 'r2', date: SH.utils.daysAgoISO(7) },
      { id: 'rc8',  taskId: 'd3', roommateId: 'r3', date: SH.utils.daysAgoISO(8) },
      { id: 'rc9',  taskId: 'd4', roommateId: 'r4', date: SH.utils.daysAgoISO(7) },
      { id: 'rc10', taskId: 'd5', roommateId: 'r1', date: SH.utils.daysAgoISO(8) }
    ],
    leaves: []
  };

  const items = [
    { id: 'i1', emoji: '🧻', name: '抽纸',   unit: '包', qty: 3, threshold: 2, refills: [{ id: 'f1', roommateId: 'r2', qty: 4, date: SH.utils.daysAgoISO(5) }] },
    { id: 'i2', emoji: '🧴', name: '洗洁精', unit: '瓶', qty: 1, threshold: 1, refills: [{ id: 'f2', roommateId: 'r2', qty: 1, date: SH.utils.daysAgoISO(6) }] },
    { id: 'i3', emoji: '🗑️', name: '垃圾袋', unit: '卷', qty: 1, threshold: 2, refills: [{ id: 'f3', roommateId: 'r2', qty: 3, date: SH.utils.daysAgoISO(6) }] },
    { id: 'i4', emoji: '🧺', name: '洗衣液', unit: '瓶', qty: 2, threshold: 1, refills: [{ id: 'f4', roommateId: 'r1', qty: 2, date: SH.utils.daysAgoISO(10) }] },
    { id: 'i5', emoji: '🍚', name: '大米',   unit: 'kg', qty: 4, threshold: 2, refills: [{ id: 'f5', roommateId: 'r3', qty: 5, date: SH.utils.daysAgoISO(12) }] },
    { id: 'i6', emoji: '💧', name: '桶装水', unit: '桶', qty: 6, threshold: 3, refills: [{ id: 'f6', roommateId: 'r4', qty: 8, date: SH.utils.daysAgoISO(8) }] }
  ];

  const rules = [
    { id: 'u1', text: '晚上 11 点后公共区域保持安静', proposerId: 'r1', agreeIds: ['r1','r2','r4'], date: SH.utils.daysAgoISO(14) },
    { id: 'u2', text: '垃圾当日值日生负责倾倒，不隔夜', proposerId: 'r2', agreeIds: ['r1','r2','r3','r4'], date: SH.utils.daysAgoISO(20) },
    { id: 'u3', text: '公共物品用完须及时补货并登记', proposerId: 'r3', agreeIds: ['r3','r1'], date: SH.utils.daysAgoISO(5) },
    { id: 'u4', text: '带访客过夜需提前在群里说明', proposerId: 'r4', agreeIds: ['r4'], date: SH.utils.daysAgoISO(2) }
  ];

  return {
    roommates, bills, dutyTasks, schedule, items, rules,
    meta: { seededAt: today, version: 2 }
  };
};
