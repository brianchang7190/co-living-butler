/* ============================================================
   store.js · 状态管理、localStorage 持久化、分摊与结算算法
   ============================================================ */
window.SH = window.SH || {};

/* ---------- 计算：分摊 & 结算（纯函数） ---------- */
SH.calc = {
  /**
   * 将金额按权重分摊到 ids，返回 { id: 金额(元) }
   * 使用「分」为单位做整数分配，避免浮点误差。
   */
  splitAmount(amount, ids, weights) {
    const cents = Math.round(amount * 100);
    const ws = ids.map(id => (weights && weights[id]) ? weights[id] : 1);
    const totalW = ws.reduce((a, b) => a + b, 0) || 1;
    const raw = ws.map(w => (cents * w) / totalW);
    let shares = raw.map(r => Math.floor(r));
    let remainder = cents - shares.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) shares[order[k % order.length].i]++;

    const out = {};
    ids.forEach((id, i) => { out[id] = shares[i] / 100; });
    return out;
  },

  /** 单笔账单的分摊结果 */
  billShares(bill) {
    if (bill.splitMode === 'amount' && bill.splitAmounts) {
      const out = {};
      bill.splitIds.forEach(id => { out[id] = bill.splitAmounts[id] || 0; });
      return out;
    }
    const weights = bill.splitMode === 'custom' ? bill.splitWeights : null;
    return SH.calc.splitAmount(bill.amount, bill.splitIds, weights);
  },

  /**
   * 全员结算：每人 { paid, owed, net }
   * net > 0 表示被欠，net < 0 表示欠款。
   */
  balances(roommates, bills) {
    const res = {};
    roommates.forEach(r => { res[r.id] = { paid: 0, owed: 0, net: 0 }; });

    bills.forEach(b => {
      if (!res[b.payerId]) res[b.payerId] = { paid: 0, owed: 0, net: 0 };
      res[b.payerId].paid += b.amount;
      const shares = SH.calc.billShares(b);
      Object.keys(shares).forEach(id => {
        if (!res[id]) res[id] = { paid: 0, owed: 0, net: 0 };
        res[id].owed += shares[id];
      });
    });

    Object.keys(res).forEach(id => {
      const r = res[id];
      r.paid = Math.round(r.paid * 100) / 100;
      r.owed = Math.round(r.owed * 100) / 100;
      r.net = Math.round((r.paid - r.owed) * 100) / 100;
    });
    return res;
  },

  /** 最小化转账建议：返回 [{ from, to, amount }] */
  settle(roommates, bills) {
    const bal = SH.calc.balances(roommates, bills);
    const creditors = []; // 被欠
    const debtors = [];   // 欠款
    roommates.forEach(r => {
      const b = bal[r.id];
      if (!b) return;
      if (b.net > 0.005) creditors.push({ id: r.id, amount: b.net });
      else if (b.net < -0.005) debtors.push({ id: r.id, amount: -b.net });
    });

    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      let m = Math.min(d.amount, c.amount);
      m = Math.round(m * 100) / 100;
      if (m > 0) transfers.push({ from: d.id, to: c.id, amount: m });
      d.amount = Math.round((d.amount - m) * 100) / 100;
      c.amount = Math.round((c.amount - m) * 100) / 100;
      if (d.amount < 0.005) i++;
      if (c.amount < 0.005) j++;
    }
    return transfers;
  },

  /** 分类汇总（按账单类型） */
  categories(bills) {
    const map = {};
    bills.forEach(b => {
      map[b.type] = (map[b.type] || 0) + b.amount;
    });
    return Object.keys(map)
      .map(t => ({ type: t, amount: Math.round(map[t] * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }
};

/* ---------- 存储 ---------- */
SH.store = (function () {
  const KEY = 'co-living-house-v1';
  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.roommates && parsed.bills) {
          state = migrate(parsed);
          return;
        }
      }
    } catch (e) { /* 忽略，走 seed */ }
    state = SH.seed();
    persist();
  }

  function migrate(s) {
    s.bills.forEach(b => { if (b.settled === undefined) b.settled = false; });
    s.dutyTasks.forEach(t => {
      if (!t.area) t.area = '其他';
      if (t.day === undefined) t.day = (t.freq === '每周' ? 6 : (t.freq === '每月' ? 1 : null));
    });
    if (!s.schedule) {
      s.schedule = { weekStart: SH.utils.weekStartISO(), weekEnd: SH.utils.weekEndISO(), assignments: {}, done: {}, records: [], leaves: [] };
    } else {
      if (!s.schedule.records) s.schedule.records = [];
      if (!s.schedule.leaves) s.schedule.leaves = [];
    }
    if (!s.meta) s.meta = {};
    s.meta.version = 2;
    return s;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* 存储不可用时静默降级 */ }
  }

  function reset() {
    state = SH.seed();
    persist();
  }

  /* ---- 通用查询 ---- */
  function roommate(id) {
    return state.roommates.find(r => r.id === id);
  }
  function roommateName(id) {
    const r = roommate(id);
    return r ? r.name : '已离开';
  }
  function billType(type) {
    return SH.BILL_TYPES.find(t => t.value === type) || { label: '其他', emoji: '📌' };
  }

  return {
    get state() { return state; },

    init() { if (!state) load(); },
    save() { persist(); },
    reset() { reset(); },
    roommate, roommateName, billType,

    /* ---- 室友 ---- */
    addRoommate(name, color) {
      const id = SH.utils.uid('r');
      state.roommates.push({ id, name, color, joined: SH.utils.todayISO() });
      persist();
      return id;
    },
    removeRoommate(id) {
      const hasRef = state.bills.some(b => b.payerId === id || b.splitIds.includes(id)) ||
                     state.rules.some(r => r.proposerId === id || r.agreeIds.includes(id)) ||
                     Object.values(state.schedule.assignments).includes(id) ||
                     state.items.some(it => (it.refills || []).some(f => f.roommateId === id));
      if (hasRef) return false;
      state.roommates = state.roommates.filter(r => r.id !== id);
      persist();
      return true;
    },

    /* ---- 账单 ---- */
    addBill(bill) {
      bill.id = SH.utils.uid('b');
      state.bills.unshift(bill);
      persist();
      return bill;
    },
    removeBill(id) {
      state.bills = state.bills.filter(b => b.id !== id);
      persist();
    },
    toggleSettled(id) {
      const b = state.bills.find(x => x.id === id);
      if (b) { b.settled = !b.settled; persist(); }
    },

    /* ---- 值日 ---- */
    addDutyTask(task) {
      task.id = SH.utils.uid('d');
      state.dutyTasks.push(task);
      state.schedule.assignments[task.id] = state.roommates[0].id;
      persist();
      return task;
    },
    removeDutyTask(id) {
      state.dutyTasks = state.dutyTasks.filter(t => t.id !== id);
      delete state.schedule.assignments[id];
      delete state.schedule.done[id];
      persist();
    },
    setAssignment(taskId, roommateId) {
      state.schedule.assignments[taskId] = roommateId;
      persist();
    },
    toggleDone(taskId, roommateId) {
      const today = SH.utils.todayISO();
      const cur = state.schedule.done[taskId];
      if (cur === today) {
        delete state.schedule.done[taskId];
        state.schedule.records = state.schedule.records.filter(r => !(r.taskId === taskId && r.date === today));
      } else {
        state.schedule.done[taskId] = today;
        state.schedule.records.push({ id: SH.utils.uid('rc'), taskId, roommateId: roommateId || state.schedule.assignments[taskId], date: today });
      }
      persist();
    },
    isDone(taskId) {
      return state.schedule.done[taskId] === SH.utils.todayISO();
    },
    swapAssignments(taskA, taskB) {
      const a = state.schedule.assignments[taskA];
      const b = state.schedule.assignments[taskB];
      state.schedule.assignments[taskA] = b;
      state.schedule.assignments[taskB] = a;
      persist();
    },
    addLeave(taskId, roommateId, reason) {
      state.schedule.leaves = state.schedule.leaves.filter(l => l.taskId !== taskId);
      const leave = { id: SH.utils.uid('lv'), taskId, roommateId, reason, date: SH.utils.todayISO() };
      state.schedule.leaves.push(leave);
      persist();
      return leave;
    },
    removeLeave(taskId) {
      state.schedule.leaves = state.schedule.leaves.filter(l => l.taskId !== taskId);
      persist();
    },
    getLeave(taskId) {
      return state.schedule.leaves.find(l => l.taskId === taskId) || null;
    },
    /** 轮换：每个任务顺延给下一位室友 */
    rotate() {
      const ids = state.roommates.map(r => r.id);
      if (!ids.length) return;
      const tasks = state.dutyTasks;
      tasks.forEach((t, idx) => {
        const cur = state.schedule.assignments[t.id];
        const curIdx = ids.indexOf(cur);
        const nextIdx = curIdx < 0 ? idx % ids.length : (curIdx + 1) % ids.length;
        state.schedule.assignments[t.id] = ids[nextIdx];
      });
      state.schedule.weekStart = SH.utils.weekStartISO();
      state.schedule.weekEnd = SH.utils.weekEndISO();
      state.schedule.done = {};
      persist();
    },

    /* ---- 物品 ---- */
    addItem(item) {
      item.id = SH.utils.uid('i');
      item.refills = [];
      state.items.push(item);
      persist();
      return item;
    },
    removeItem(id) {
      state.items = state.items.filter(it => it.id !== id);
      persist();
    },
    updateQty(id, qty) {
      const it = state.items.find(x => x.id === id);
      if (it) { it.qty = Math.max(0, Number(qty)); persist(); }
    },
    refill(id, roommateId, qty) {
      const it = state.items.find(x => x.id === id);
      if (it) {
        it.qty = Math.round((it.qty + Number(qty)) * 100) / 100;
        it.refills.push({ id: SH.utils.uid('f'), roommateId, qty: Number(qty), date: SH.utils.todayISO() });
        persist();
      }
    },
    isLow(item) {
      return item.qty <= item.threshold;
    },

    /* ---- 公约 ---- */
    addRule(rule) {
      rule.id = SH.utils.uid('u');
      rule.agreeIds = [rule.proposerId];
      state.rules.push(rule);
      persist();
      return rule;
    },
    toggleAgree(ruleId, roommateId) {
      const r = state.rules.find(x => x.id === ruleId);
      if (!r) return;
      const i = r.agreeIds.indexOf(roommateId);
      if (i >= 0) r.agreeIds.splice(i, 1);
      else r.agreeIds.push(roommateId);
      persist();
    },
    removeRule(id) {
      state.rules = state.rules.filter(r => r.id !== id);
      persist();
    }
  };
})();
