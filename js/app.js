/* ============================================================
   app.js · 渲染、交互、弹窗表单
   ============================================================ */
window.SH = window.SH || {};
(function () {
  const store = SH.store;
  const calc = SH.calc;
  const U = SH.utils;

  let currentUserId = null;
  const billFilter = { type: '', month: '', payer: '', status: '' };
  let calMonthOffset = 0;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function me() { return currentUserId; }
  function meName() { return store.roommateName(me()); }
  function getState() { return store.state; }

  /* ============================================================
     渲染
     ============================================================ */

  function renderAll() {
    renderHeader();
    renderHome();
    renderBills();
    renderDuty();
    renderItems();
    renderRules();
  }

  function renderHeader() {
    const n = getState().roommates.length;
    document.getElementById('houseLabel').textContent = `我是 ${meName()} · ${n} 人同住`;
    document.getElementById('greetingTitle').textContent = U.greeting() + '，' + meName();
    document.getElementById('todayDate').textContent = U.todayCN();
  }

  /* ---- 首页 ---- */
  function renderHome() {
    const s = getState();
    const bills = s.bills;

    // 本月支出
    const monthStart = U.monthStartISO();
    const monthBills = bills.filter(b => b.date >= monthStart);
    const total = monthBills.reduce((a, b) => a + b.amount, 0);
    document.getElementById('statExpense').textContent = U.fmtMoney(total);

    // 待结算（仅未结账单）
    const openBills = bills.filter(b => !b.settled);
    const transfers = calc.settle(s.roommates, openBills);
    const pending = transfers.reduce((a, t) => a + t.amount, 0);
    document.getElementById('statSettle').textContent = U.fmtMoney(pending);

    // 值日待办
    const pendingDuties = s.dutyTasks.filter(t => isPending(t.id));
    const dutyEl = document.getElementById('homeDuty');
    if (!pendingDuties.length) {
      dutyEl.innerHTML = `<div class="card empty">🎉 值日全部完成</div>`;
    } else {
      dutyEl.innerHTML = pendingDuties.slice(0, 4).map(t => {
        const rid = s.schedule.assignments[t.id];
        return `<div class="card duty-item">
          <span class="duty-emoji">${esc(t.emoji)}</span>
          <div class="duty-main">
            <div class="duty-name">${esc(t.name)}</div>
            <div class="duty-assign"><b>${esc(store.roommateName(rid))}</b> · ${esc(taskScheduleLabel(t))}</div>
          </div>
          <button class="ghost-btn" data-action="toggleDone" data-id="${t.id}">完成</button>
        </div>`;
      }).join('');
    }

    // 补货提醒
    const lowItems = s.items.filter(it => store.isLow(it));
    const itemsEl = document.getElementById('homeItems');
    itemsEl.innerHTML = lowItems.length
      ? lowItems.slice(0, 4).map(it => `
        <div class="card item-card">
          <div class="item-row1">
            <span class="item-emoji">${esc(it.emoji)}</span>
            <div class="item-main">
              <div class="item-name">${esc(it.name)}</div>
              <div class="item-meta">余量 ${U.fmtNum(it.qty)} ${esc(it.unit)} · 阈值 ${U.fmtNum(it.threshold)}</div>
            </div>
            <span class="tag low">需补货</span>
          </div>
        </div>`).join('')
      : `<div class="card empty">✅ 公共物品充足</div>`;

    // 待确认公约
    const totalRm = s.roommates.length;
    const pendingRules = s.rules.filter(r => r.agreeIds.length < totalRm);
    const rulesEl = document.getElementById('homeRules');
    rulesEl.innerHTML = pendingRules.length
      ? pendingRules.slice(0, 3).map(r => `
        <div class="card rule-home">
          <div class="rule-text" style="font-size:13.5px">${esc(r.text)}</div>
          <div class="rule-meta">${r.agreeIds.length}/${totalRm} 人同意 · ${esc(store.roommateName(r.proposerId))} 发起</div>
        </div>`).join('')
      : `<div class="card empty">📜 暂无待确认公约</div>`;
  }

  /* ---- 费用 ---- */
  function renderBills() {
    const s = getState();
    const allBills = s.bills;

    fillBillFilters(allBills);

    // 汇总（本月全部）
    const monthStart = U.monthStartISO();
    const monthBills = allBills.filter(b => b.date >= monthStart);
    const total = monthBills.reduce((a, b) => a + b.amount, 0);
    const avg = s.roommates.length ? total / s.roommates.length : 0;
    document.getElementById('billTotal').textContent = U.fmtMoney(total);
    document.getElementById('billAvg').textContent = U.fmtMoney(avg);

    // 分类条
    const cats = calc.categories(monthBills);
    const maxCat = cats.length ? cats[0].amount : 1;
    document.getElementById('billCategories').innerHTML = cats.map(c => {
      const t = store.billType(c.type);
      const pct = Math.round(c.amount / maxCat * 100);
      return `<div class="cat-row">
        <span class="cat-name">${esc(t.emoji)} ${t.label}</span>
        <div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div>
        <span class="cat-amount mono">${U.fmtMoney(c.amount)}</span>
      </div>`;
    }).join('') || '<div class="cat-row" style="color:var(--ink-3)">本月暂无账单</div>';

    // 结算（仅未结账单）
    const openBills = allBills.filter(b => !b.settled);
    const settledCount = allBills.length - openBills.length;
    const transfers = calc.settle(s.roommates, openBills);
    const pending = transfers.reduce((a, t) => a + t.amount, 0);
    const panel = document.getElementById('settlePanel');
    if (!transfers.length) {
      panel.className = 'settle-panel settled';
      panel.innerHTML = `<div class="settle-title">✅ 费用已全部结清</div>`;
    } else {
      panel.className = 'settle-panel';
      panel.innerHTML = `
        <div class="settle-title">待结算 <span class="mono">${U.fmtMoney(pending)}</span> · ${openBills.length} 笔未结${settledCount ? ` · ${settledCount} 笔已结` : ''}</div>
        ${transfers.map(t => `
          <div class="settle-item">
            <span>${esc(store.roommateName(t.from))} → ${esc(store.roommateName(t.to))}</span>
            <span class="amount owe">${U.fmtMoney(t.amount)}</span>
          </div>`).join('')}`;
    }

    // 账单列表（筛选后）
    const filtered = applyBillFilter(allBills);
    document.getElementById('billCount').textContent = `${filtered.length} 笔`;
    document.getElementById('billList').innerHTML = filtered.length
      ? filtered.map(b => {
        const t = store.billType(b.type);
        return `<div class="card bill-card">
          <div class="bill-ico">${esc(t.emoji)}</div>
          <div class="bill-main">
            <div class="bill-title">${t.label}${b.note ? ' · ' + esc(b.note) : ''} ${b.settled ? '<span class="tag ok">已结</span>' : '<span class="tag low">未结</span>'}</div>
            <div class="bill-sub">${U.fmtDate(b.date)} · ${esc(store.roommateName(b.payerId))} 垫付 · ${esc(splitModeLabel(b))} ${b.splitIds.length}人</div>
          </div>
          <div class="bill-amt">
            <div class="mono">${U.fmtMoney(b.amount)}</div>
            <button class="ghost-btn bill-delete" data-action="toggleSettled" data-id="${b.id}">${b.settled ? '标记未结' : '标记已结'}</button>
            <button class="ghost-btn bill-delete" data-action="delBill" data-id="${b.id}">删除</button>
          </div>
        </div>`;
      }).join('')
      : `<div class="card empty">没有符合条件的账单</div>`;
  }

  function splitModeLabel(b) {
    if (b.splitMode === 'amount') return '自定义金额';
    if (b.splitMode === 'custom') return '自定义比例';
    if (b.splitMode === 'head') return '按人头';
    return '均摊';
  }

  function fillBillFilters(bills) {
    const types = [...new Set(bills.map(b => b.type))];
    const months = [...new Set(bills.map(b => b.date.slice(0, 7)))].sort().reverse();
    const payers = [...new Set(bills.map(b => b.payerId))];

    setSelectOptions('fType', [{ v: '', l: '全部类型' }].concat(types.map(t => ({ v: t, l: store.billType(t).emoji + ' ' + store.billType(t).label }))), billFilter.type);
    setSelectOptions('fMonth', [{ v: '', l: '全部月份' }].concat(months.map(m => ({ v: m, l: m.replace('-', '年') + '月' }))), billFilter.month);
    setSelectOptions('fPayer', [{ v: '', l: '全部付款人' }].concat(payers.map(p => ({ v: p, l: store.roommateName(p) }))), billFilter.payer);
  }

  function setSelectOptions(id, opts, selected) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = (selected === undefined || selected === null) ? el.value : selected;
    el.innerHTML = opts.map(o => `<option value="${o.v}" ${o.v === cur ? 'selected' : ''}>${esc(o.l)}</option>`).join('');
  }

  function applyBillFilter(bills) {
    return bills.filter(b => {
      if (billFilter.type && b.type !== billFilter.type) return false;
      if (billFilter.month && b.date.slice(0, 7) !== billFilter.month) return false;
      if (billFilter.payer && b.payerId !== billFilter.payer) return false;
      if (billFilter.status === 'open' && b.settled) return false;
      if (billFilter.status === 'settled' && !b.settled) return false;
      return true;
    });
  }

  function exportCsv() {
    const filtered = applyBillFilter(getState().bills);
    if (!filtered.length) { toast('没有可导出的账单'); return; }
    const header = ['日期', '类型', '金额', '付款人', '分摊方式', '参与人', '备注', '状态'];
    const rows = filtered.map(b => {
      const t = store.billType(b.type);
      const participants = b.splitIds.map(id => store.roommateName(id)).join('/');
      return [b.date, t.label, b.amount, store.roommateName(b.payerId), splitModeLabel(b), participants, b.note || '', b.settled ? '已结' : '未结'];
    });
    const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '账单导出_' + U.todayISO() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('已导出 CSV');
  }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  /* ---- 值日 ---- */
  function taskScheduleLabel(t) {
    if (t.freq === '每天') return '每天';
    if (t.freq === '每周') return '每周' + SH.DOW[t.day || 0];
    return '每月' + (t.day || 1) + '号';
  }

  function isPending(taskId) {
    const s = getState();
    const task = s.dutyTasks.find(t => t.id === taskId);
    const doneDate = s.schedule.done[taskId];
    if (!doneDate) return true;
    if (!task) return false;
    if (task.freq === '每天') return doneDate !== U.todayISO();
    if (task.freq === '每月') return doneDate < U.monthStartISO();
    return doneDate < s.schedule.weekStart || doneDate > s.schedule.weekEnd;
  }

  function dutyItemHtml(t) {
    const s = getState();
    const rid = s.schedule.assignments[t.id];
    const done = !isPending(t.id);
    const leave = store.getLeave(t.id);
    return `<div class="duty-item ${done ? 'done' : ''}">
      <span class="duty-emoji">${esc(t.emoji)}</span>
      <div class="duty-main">
        <div class="duty-name">${esc(t.name)} <span class="tag area">${esc(t.area || '其他')}</span></div>
        <div class="duty-assign">
          <button class="assign-link" data-action="assign" data-id="${t.id}">${esc(store.roommateName(rid))} ▾</button>
          <span>· ${esc(taskScheduleLabel(t))}</span>
          ${done ? '<span class="tag ok" style="margin-left:6px">已完成</span>' : ''}
          ${leave ? '<span class="tag low" style="margin-left:6px">请假中</span>' : ''}
        </div>
      </div>
      <button class="duty-check" data-action="toggleDone" data-id="${t.id}" aria-label="完成">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      </button>
    </div>`;
  }

  function renderDuty() {
    const s = getState();
    const pendingCount = s.dutyTasks.filter(t => isPending(t.id)).length;
    document.getElementById('weekBanner').innerHTML =
      `本周排班 <span class="mono">${U.fmtDate(s.schedule.weekStart)} ~ ${U.fmtDate(s.schedule.weekEnd)}</span> · ${pendingCount} 项待完成`;

    // 列表视图（按区域分组）
    const groups = {};
    s.dutyTasks.forEach(t => { const a = t.area || '其他'; (groups[a] = groups[a] || []).push(t); });
    const order = SH.AREAS.filter(a => groups[a]).concat(Object.keys(groups).filter(a => !SH.AREAS.includes(a)));
    document.getElementById('dutyList').innerHTML = order.length
      ? order.map(area => `<div class="duty-area">${esc(area)}</div>${groups[area].map(dutyItemHtml).join('')}`).join('')
      : `<div class="card empty">还没有清洁任务，点右下「添加任务」</div>`;

    // 任务管理（含换班/请假/删除）
    document.getElementById('taskList').innerHTML = s.dutyTasks.length
      ? s.dutyTasks.map(t => {
        const leave = store.getLeave(t.id);
        return `<div class="card task-item">
          <div class="task-left">
            <span class="task-emoji">${esc(t.emoji)}</span>
            <div>
              <div class="task-name">${esc(t.name)}</div>
              <div class="task-freq">${esc(t.area || '其他')} · ${esc(taskScheduleLabel(t))}</div>
            </div>
          </div>
          <div class="task-actions">
            <button class="ghost-btn" data-action="swap" data-id="${t.id}">换班</button>
            <button class="ghost-btn ${leave ? 'danger' : ''}" data-action="leave" data-id="${t.id}">${leave ? '销假' : '请假'}</button>
            <button class="ghost-btn danger" data-action="delTask" data-id="${t.id}">删除</button>
          </div>
        </div>`;
      }).join('')
      : '';

    renderStats();

    if (!document.getElementById('dutyCalendarView').hidden) renderCalendar();
  }

  function renderStats() {
    const s = getState();
    const since = U.daysAgoISO(14);
    const counts = {};
    s.roommates.forEach(r => { counts[r.id] = 0; });
    s.schedule.records.forEach(r => {
      if (r.date >= since && counts[r.roommateId] !== undefined) counts[r.roommateId]++;
    });
    const ranked = s.roommates.map(r => ({ name: r.name, color: r.color, count: counts[r.id] })).sort((a, b) => b.count - a.count);
    document.getElementById('dutyStats').innerHTML = ranked.length
      ? ranked.map((r, i) => `
        <div class="card task-item">
          <div class="task-left">
            <span class="rm-avatar" style="background:${r.color}">${esc(r.name[0])}</span>
            <div>
              <div class="task-name">${i === 0 ? '👑 ' : ''}${esc(r.name)}</div>
              <div class="task-freq">近14天完成 ${r.count} 次</div>
            </div>
          </div>
          <span class="mono" style="font-size:20px;font-weight:600">${r.count}</span>
        </div>`).join('')
      : `<div class="card empty">暂无完成记录</div>`;
  }

  /* ---- 日历视图 ---- */
  function tasksOnDate(date) {
    const s = getState();
    const dow = date.getDay();
    const dom = date.getDate();
    return s.dutyTasks.filter(t => {
      if (t.freq === '每天') return true;
      if (t.freq === '每周') return t.day === dow;
      if (t.freq === '每月') return t.day === dom;
      return false;
    });
  }

  function renderCalendar() {
    const s = getState();
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
    const year = base.getFullYear(), month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = base.getDay();
    const todayISO = U.todayISO();

    let html = `<div class="cal-head">
      <button class="icon-btn" data-action="calPrev" aria-label="上个月">‹</button>
      <div class="cal-title">${year} 年 ${month + 1} 月</div>
      <button class="icon-btn" data-action="calNext" aria-label="下个月">›</button>
    </div><div class="cal-grid">`;
    html += SH.DOW.map(d => `<div class="cal-dow">周${d}</div>`).join('');
    for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = U.isoDate(date);
      const dayTasks = tasksOnDate(date);
      const isToday = iso === todayISO;
      html += `<div class="cal-cell ${isToday ? 'today' : ''}">
        <div class="cal-date">${d}</div>
        <div class="cal-tasks">${dayTasks.map(t => {
          const rid = s.schedule.assignments[t.id];
          return `<div class="cal-task" title="${esc(t.name)}·${esc(store.roommateName(rid))}">${esc(t.emoji)}<span>${esc(store.roommateName(rid)[0])}</span></div>`;
        }).join('')}</div>
      </div>`;
    }
    html += `</div>`;
    document.getElementById('dutyCalendar').innerHTML = html;
  }

  function setDutyView(view) {
    document.querySelectorAll('#dutySeg .seg-btn').forEach(b => b.classList.toggle('is-active', b.dataset.dutyview === view));
    document.getElementById('dutyListView').hidden = view !== 'list';
    document.getElementById('dutyCalendarView').hidden = view !== 'calendar';
    if (view === 'calendar') renderCalendar();
  }

  /* ---- 物品 ---- */
  function renderItems() {
    const s = getState();
    const low = s.items.filter(it => store.isLow(it));
    const banner = document.getElementById('stockBanner');
    if (low.length) {
      banner.className = 'stock-banner has-low';
      banner.innerHTML = `⚠️ 有 <b>${low.length}</b> 件公共物品需要补货：${low.map(i => esc(i.name)).join('、')}`;
    } else {
      banner.className = 'stock-banner ok';
      banner.textContent = '✅ 公共物品库存充足';
    }

    document.getElementById('itemList').innerHTML = s.items.length
      ? s.items.map(it => {
        const isLow = store.isLow(it);
        const pct = it.threshold > 0 ? Math.min(100, Math.round(it.qty / (it.threshold * 2) * 100)) : (it.qty > 0 ? 100 : 0);
        const last = (it.refills || []).slice(-1)[0];
        return `<div class="card item-card">
          <div class="item-row1">
            <span class="item-emoji">${esc(it.emoji)}</span>
            <div class="item-main">
              <div class="item-name">${esc(it.name)} ${isLow ? '<span class="tag low">需补货</span>' : '<span class="tag ok">充足</span>'}</div>
              <div class="item-meta">${last ? `最近补货 ${U.fmtDate(last.date)} · ${esc(store.roommateName(last.roommateId))}` : '暂无补货记录'}</div>
            </div>
            <div class="item-qty-block">
              <span class="item-qty">${U.fmtNum(it.qty)}${esc(it.unit)}</span>
              <div class="level-track"><div class="level-fill ${isLow ? 'low' : ''}" style="width:${pct}%"></div></div>
            </div>
          </div>
          <div class="item-row2">
            <button class="ghost-btn" data-action="consume" data-id="${it.id}">− 消耗</button>
            <button class="ghost-btn" data-action="refill" data-id="${it.id}">＋ 补货</button>
            <button class="ghost-btn danger" data-action="delItem" data-id="${it.id}">删除</button>
          </div>
        </div>`;
      }).join('')
      : `<div class="card empty">还没有登记物品，点右上角「登记物品」</div>`;
  }

  /* ---- 公约 ---- */
  function renderRules() {
    const s = getState();
    const total = s.roommates.length;
    document.getElementById('ruleList').innerHTML = s.rules.length
      ? s.rules.map(r => {
        const active = r.agreeIds.length >= total;
        const agreeAvatars = r.agreeIds.map(id => {
          const rm = store.roommate(id);
          return rm ? `<span class="avatar" style="background:${rm.color}" title="${esc(rm.name)}">${esc(rm.name[0])}</span>` : '';
        }).join('');
        const iAgree = r.agreeIds.includes(me());
        return `<div class="rule-item ${active ? 'active' : ''}">
          <div class="rule-top">
            <div class="rule-text">${esc(r.text)}</div>
            <span class="tag ${active ? 'ok' : 'low'}">${active ? '已生效' : '待确认'}</span>
          </div>
          <div class="rule-meta">${U.fmtDate(r.date)} · ${esc(store.roommateName(r.proposerId))} 发起</div>
          <div class="rule-foot">
            <div class="agree-progress">
              <div class="agree-avatars">${agreeAvatars || '<span style="color:var(--ink-3);font-size:12px">暂无</span>'}</div>
              <span>${r.agreeIds.length}/${total} 同意</span>
              <div class="progress-track"><div class="progress-fill" style="width:${Math.round(r.agreeIds.length / total * 100)}%"></div></div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="ghost-btn ${iAgree ? 'danger' : ''}" data-action="agree" data-id="${r.id}">${iAgree ? '取消同意' : '我同意'}</button>
              <button class="ghost-btn danger" data-action="delRule" data-id="${r.id}">删除</button>
            </div>
          </div>
        </div>`;
      }).join('')
      : `<div class="card empty">还没有公约，点右上角「发起公约」</div>`;
  }

  /* ============================================================
     弹窗系统
     ============================================================ */
  function openModal(title, bodyHtml, onSubmit) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalBackdrop').hidden = false;
    document.getElementById('modal').hidden = false;
    document.getElementById('modal')._onSubmit = onSubmit;
  }

  function closeModal() {
    document.getElementById('modalBackdrop').hidden = true;
    document.getElementById('modal').hidden = true;
  }

  /* ============================================================
     各表单
     ============================================================ */
  function optionsOfRoommates(selected) {
    return getState().roommates.map(r =>
      `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  }

  function openBillForm() {
    const s = getState();
    const typeOpts = SH.BILL_TYPES.map(t => `<option value="${t.value}">${esc(t.emoji)} ${t.label}</option>`).join('');
    const modeOpts = SH.SPLIT_MODES.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    const chips = s.roommates.map(r =>
      `<span class="chip is-on" data-id="${r.id}"><span class="avatar" style="background:${r.color}">${esc(r.name[0])}</span>${esc(r.name)}</span>`).join('');

    openModal('记一笔', `
      <form id="billForm">
        <div class="field-row">
          <div class="field"><label>类型</label><select name="type">${typeOpts}</select></div>
          <div class="field"><label>金额（元）</label><input name="amount" class="mono" type="number" step="0.01" min="0" placeholder="0.00" required></div>
        </div>
        <div class="field"><label>谁垫付的</label><select name="payer">${optionsOfRoommates(me())}</select></div>
        <div class="field"><label>分摊方式</label><select name="splitMode">${modeOpts}</select></div>
        <div class="field"><label>参与分摊的人</label><div class="chip-group" id="splitChips">${chips}</div></div>
        <div class="field" id="customWeights" hidden></div>
        <div class="field-row">
          <div class="field"><label>日期</label><input name="date" type="date" value="${U.todayISO()}"></div>
          <div class="field"><label>备注</label><input name="note" placeholder="可选"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">保存</button>
        </div>
      </form>
    `, function (form) {
      const amount = Math.round((parseFloat(form.amount.value) || 0) * 100) / 100;
      if (!amount || amount <= 0) { toast('请输入有效金额'); return false; }
      const splitIds = [...document.querySelectorAll('#splitChips .chip.is-on')].map(c => c.dataset.id);
      if (!splitIds.length) { toast('请至少选择一位参与人'); return false; }
      const mode = form.splitMode.value;
      let weights = null, splitAmounts = null;
      if (mode === 'custom') {
        weights = {};
        splitIds.forEach(id => { weights[id] = parseFloat(document.querySelector(`input[name="w_${id}"]`).value) || 0; });
        if (splitIds.every(id => !weights[id])) { toast('请填写有效的分摊比例'); return false; }
      } else if (mode === 'amount') {
        splitAmounts = {};
        splitIds.forEach(id => { splitAmounts[id] = Math.round((parseFloat(document.querySelector(`input[name="a_${id}"]`).value) || 0) * 100) / 100; });
        const sum = splitIds.reduce((a, id) => a + splitAmounts[id], 0);
        if (Math.abs(sum - amount) > 0.01) { toast(`每人金额总和需等于 ¥${U.fmtNum(amount)}`); return false; }
      }
      store.addBill({
        type: form.type.value, amount, payerId: form.payer.value,
        splitMode: mode, splitIds, splitWeights: weights, splitAmounts,
        date: form.date.value, note: form.note.value.trim(), settled: false
      });
      toast('账单已记录');
      return true;
    });

    // 交互
    const splitMode = document.querySelector('[name="splitMode"]');
    const chipGroup = document.getElementById('splitChips');
    const amountInput = document.querySelector('[name="amount"]');
    function refreshCustom() {
      const box = document.getElementById('customWeights');
      const mode = splitMode.value;
      const ids = [...chipGroup.querySelectorAll('.chip.is-on')].map(c => c.dataset.id);
      if (mode !== 'custom' && mode !== 'amount') { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      if (mode === 'custom') {
        box.innerHTML = `<label>自定义比例（权重）</label>` + ids.map(id => {
          const r = store.roommate(id);
          return `<div class="field-row" style="margin-top:8px;align-items:center">
            <div class="field" style="flex:1;margin:0"><label style="font-weight:500;color:var(--ink)">${esc(r.name)}</label></div>
            <div class="field" style="flex:1;margin:0"><input class="mono" name="w_${id}" type="number" step="0.1" min="0" value="1"></div>
          </div>`;
        }).join('');
      } else {
        const amt = parseFloat(amountInput.value) || 0;
        const each = ids.length ? Math.round(amt / ids.length * 100) / 100 : 0;
        box.innerHTML = `<label>每人具体金额（总和需等于账单金额）</label>` + ids.map(id => {
          const r = store.roommate(id);
          return `<div class="field-row" style="margin-top:8px;align-items:center">
            <div class="field" style="flex:1;margin:0"><label style="font-weight:500;color:var(--ink)">${esc(r.name)}</label></div>
            <div class="field" style="flex:1;margin:0"><input class="mono" name="a_${id}" type="number" step="0.01" min="0" value="${each}"></div>
          </div>`;
        }).join('');
      }
    }
    splitMode.addEventListener('change', refreshCustom);
    amountInput.addEventListener('input', refreshCustom);
    chipGroup.addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      chip.classList.toggle('is-on');
      refreshCustom();
    });
  }

  function openDutyForm() {
    const areaOpts = SH.AREAS.map(a => `<option>${a}</option>`).join('');
    openModal('添加清洁任务', `
      <form id="dutyForm">
        <div class="field-row">
          <div class="field"><label>图标</label><input name="emoji" value="🧹" maxlength="4"></div>
          <div class="field"><label>任务名称</label><input name="name" placeholder="如：客厅清扫" required></div>
        </div>
        <div class="field-row">
          <div class="field"><label>区域</label><select name="area">${areaOpts}</select></div>
          <div class="field"><label>频率</label><select name="freq" id="dutyFreq"><option>每天</option><option>每周</option><option>每月</option></select></div>
        </div>
        <div class="field" id="dutyDayField" hidden><label>每周的星期几 / 每月几号</label><select name="day" id="dutyDaySelect"></select></div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">添加</button>
        </div>
      </form>
    `, function (form) {
      const freq = form.freq.value;
      const day = freq === '每天' ? null : Number(form.day.value);
      store.addDutyTask({ emoji: form.emoji.value.trim() || '🧹', name: form.name.value.trim(), freq, area: form.area.value, day });
      toast('任务已添加');
      return true;
    });

    const freqEl = document.getElementById('dutyFreq');
    const dayField = document.getElementById('dutyDayField');
    const daySelect = document.getElementById('dutyDaySelect');
    function refreshDay() {
      const f = freqEl.value;
      if (f === '每天') { dayField.hidden = true; return; }
      dayField.hidden = false;
      if (f === '每周') daySelect.innerHTML = SH.DOW.map((d, i) => `<option value="${i}">周${d}</option>`).join('');
      else daySelect.innerHTML = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">${i + 1} 号</option>`).join('');
    }
    freqEl.addEventListener('change', refreshDay);
    refreshDay();
  }

  function openSwapForm(taskId) {
    const s = getState();
    const cur = s.dutyTasks.find(t => t.id === taskId);
    const others = s.dutyTasks.filter(t => t.id !== taskId);
    const opts = others.map(t => `<option value="${t.id}">${esc(t.emoji)} ${esc(t.name)}（现：${esc(store.roommateName(s.schedule.assignments[t.id]))}）</option>`).join('');
    openModal(`换班 · ${cur.name}`, `
      <form id="swapForm">
        <div class="field"><label>与哪个任务交换负责人？</label><select name="target">${opts}</select></div>
        <div class="field-hint">当前负责人：${esc(store.roommateName(s.schedule.assignments[taskId]))}</div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">交换</button>
        </div>
      </form>
    `, function (form) {
      store.swapAssignments(taskId, form.target.value);
      toast('已交换负责人');
      return true;
    });
  }

  function openLeaveForm(taskId) {
    const s = getState();
    const cur = s.dutyTasks.find(t => t.id === taskId);
    const existing = store.getLeave(taskId);
    if (existing) {
      openModal(`请假 · ${cur.name}`, `
        <div class="field">「${esc(store.roommateName(existing.roommateId))}」当前请假中${existing.reason ? '：' + esc(existing.reason) : ''}</div>
        <div class="modal-actions"><button type="button" class="primary-btn" data-action="cancelLeave" data-id="${taskId}">销假</button></div>
      `);
      return;
    }
    const assignee = s.schedule.assignments[taskId];
    openModal(`请假 · ${cur.name}`, `
      <form id="leaveForm">
        <div class="field"><label>请假人</label><select name="who">${optionsOfRoommates(assignee)}</select></div>
        <div class="field"><label>原因（可选）</label><input name="reason" placeholder="如：出差一周"></div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">登记请假</button>
        </div>
      </form>
    `, function (form) {
      store.addLeave(taskId, form.who.value, form.reason.value.trim());
      toast('已登记请假');
      return true;
    });
  }

  function openItemForm() {
    openModal('登记公共物品', `
      <form id="itemForm">
        <div class="field-row">
          <div class="field"><label>图标</label><input name="emoji" value="🧴" maxlength="4"></div>
          <div class="field"><label>物品名称</label><input name="name" placeholder="如：洗洁精" required></div>
        </div>
        <div class="field-row">
          <div class="field"><label>单位</label><input name="unit" placeholder="瓶 / 卷 / 包"></div>
          <div class="field"><label>当前数量</label><input name="qty" class="mono" type="number" step="0.1" min="0" placeholder="0"></div>
        </div>
        <div class="field"><label>补货阈值</label><input name="threshold" class="mono" type="number" step="0.1" min="0" placeholder="低于此数量提醒补货">
          <div class="field-hint">数量 ≤ 阈值时会在首页提醒补货</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">登记</button>
        </div>
      </form>
    `, function (form) {
      store.addItem({
        emoji: form.emoji.value.trim() || '🧴',
        name: form.name.value.trim(),
        unit: form.unit.value.trim() || '件',
        qty: Number(form.qty.value) || 0,
        threshold: Number(form.threshold.value) || 0
      });
      toast('物品已登记');
      return true;
    });
  }

  function openRuleForm() {
    openModal('发起公约', `
      <form id="ruleForm">
        <div class="field"><label>公约内容</label>
          <textarea name="text" placeholder="如：晚上 11 点后公共区域保持安静" required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">发起</button>
        </div>
      </form>
    `, function (form) {
      store.addRule({ text: form.text.value.trim(), proposerId: me(), date: U.todayISO() });
      toast('公约已发起，等待室友确认');
      return true;
    });
  }

  function openRoommateForm() {
    const s = getState();
    const list = s.roommates.map(r => `
      <div class="rm-item">
        <span class="rm-avatar" style="background:${r.color}">${esc(r.name[0])}</span>
        <div class="rm-info">
          <div class="rm-name">${esc(r.name)} ${r.id === me() ? '<span class="tag ok">当前</span>' : ''}</div>
          <div class="rm-sub">${U.fmtDate(r.joined)} 入住</div>
        </div>
        ${r.id !== me() ? `<button class="ghost-btn" data-action="setMe" data-id="${r.id}">设为当前</button>` : ''}
        ${s.roommates.length > 1 ? `<button class="ghost-btn danger" data-action="delRoommate" data-id="${r.id}">删除</button>` : ''}
      </div>`).join('');

    openModal('室友管理', `
      <div class="rm-list">${list}</div>
      <form id="rmForm" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line)">
        <div class="field"><label>添加新室友</label>
          <div class="field-row">
            <input name="name" placeholder="姓名" required>
            <button type="submit" class="primary-btn" style="flex-shrink:0">添加</button>
          </div>
        </div>
      </form>
    `, function (form) {
      const name = form.name.value.trim();
      if (!name) return false;
      const color = SH.AVATAR_COLORS[getState().roommates.length % SH.AVATAR_COLORS.length];
      store.addRoommate(name, color);
      toast('室友已添加');
      return true;
    });
  }

  function openRefillForm(itemId) {
    const it = getState().items.find(x => x.id === itemId);
    openModal(`补货 · ${it.name}`, `
      <form id="refillForm">
        <div class="field"><label>补货数量（${esc(it.unit)}）</label><input name="qty" class="mono" type="number" step="0.1" min="0.1" placeholder="0" required></div>
        <div class="field"><label>补货人</label><select name="who">${optionsOfRoommates(me())}</select></div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">补货</button>
        </div>
      </form>
    `, function (form) {
      const qty = parseFloat(form.qty.value);
      if (!qty || qty <= 0) { toast('请输入有效数量'); return false; }
      store.refill(itemId, form.who.value, qty);
      toast('补货已登记');
      return true;
    });
  }

  function openAssignForm(taskId) {
    const s = getState();
    const cur = s.schedule.assignments[taskId];
    const chips = s.roommates.map(r =>
      `<span class="chip ${r.id === cur ? 'is-on' : ''}" data-id="${r.id}"><span class="avatar" style="background:${r.color}">${esc(r.name[0])}</span>${esc(r.name)}</span>`).join('');
    openModal('指派值日人', `
      <div class="field"><label>选择负责人</label><div class="chip-group" id="assignChips">${chips}</div></div>
      <div class="modal-actions"><button type="button" class="primary-btn" data-action="confirmAssign" data-id="${taskId}">确定</button></div>
    `);
  }

  /* ============================================================
     Toast
     ============================================================ */
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === tab));
    window.scrollTo({ top: 0 });
  }

  const actions = {
    // 值日
    toggleDone(id) { store.toggleDone(id, me()); renderHome(); renderDuty(); },
    delTask(id) { if (confirm('删除该清洁任务？')) { store.removeDutyTask(id); renderHome(); renderDuty(); } },
    assign(id) { openAssignForm(id); },
    confirmAssign(id) {
      const chip = document.querySelector('#assignChips .chip.is-on');
      if (!chip) { toast('请选择一位室友'); return; }
      store.setAssignment(id, chip.dataset.id);
      closeModal(); renderHome(); renderDuty(); toast('已重新指派');
    },
    rotate() { store.rotate(); renderHome(); renderDuty(); toast('已轮换到下周排班'); },
    swap(id) { openSwapForm(id); },
    leave(id) { openLeaveForm(id); },
    cancelLeave(id) { store.removeLeave(id); closeModal(); renderHome(); renderDuty(); toast('已销假'); },
    calPrev() { calMonthOffset--; renderCalendar(); },
    calNext() { calMonthOffset++; renderCalendar(); },

    // 账单
    addBill() { openBillForm(); },
    delBill(id) { if (confirm('删除这笔账单？')) { store.removeBill(id); renderHome(); renderBills(); } },
    toggleSettled(id) { store.toggleSettled(id); renderHome(); renderBills(); },

    // 物品
    addItem() { openItemForm(); },
    consume(id) {
      const it = getState().items.find(x => x.id === id);
      store.updateQty(id, (it.qty - 1));
      renderHome(); renderItems();
      if (store.isLow(getState().items.find(x => x.id === id))) toast(`${it.name} 需要补货了`);
    },
    refill(id) { openRefillForm(id); },
    delItem(id) { if (confirm('删除该物品？')) { store.removeItem(id); renderHome(); renderItems(); } },

    // 公约
    addRule() { openRuleForm(); },
    agree(id) { store.toggleAgree(id, me()); renderHome(); renderRules(); },
    delRule(id) { if (confirm('删除该公约？')) { store.removeRule(id); renderHome(); renderRules(); } },

    // 室友
    openRoommates() { openRoommateForm(); },
    setMe(id) { currentUserId = id; localStorage.setItem('co-living-me', id); renderAll(); closeModal(); toast('已切换当前身份'); },
    delRoommate(id) {
      if (confirm('删除该室友？')) {
        if (!store.removeRoommate(id)) { toast('该室友有关联账单/公约，无法删除'); return; }
        if (me() === id) { currentUserId = getState().roommates[0].id; }
        renderAll(); closeModal();
      }
    }
  };

  function handleClick(e) {
    if (e.target.closest('[data-close]')) { closeModal(); return; }

    const tab = e.target.closest('[data-tab]');
    if (tab) { switchTab(tab.dataset.tab); return; }
    const goto = e.target.closest('[data-goto]');
    if (goto) { switchTab(goto.dataset.goto); return; }
    const dv = e.target.closest('[data-dutyview]');
    if (dv) { setDutyView(dv.dataset.dutyview); return; }

    const el = e.target.closest('[data-action]');
    if (el) {
      const fn = actions[el.dataset.action];
      if (fn) fn(el.dataset.id);
    }
  }

  function handleSubmit(e) {
    if (e.target.tagName !== 'FORM') return;
    const modal = document.getElementById('modal');
    if (modal.hidden) return;
    e.preventDefault();
    const onSubmit = modal._onSubmit;
    if (onSubmit && onSubmit(e.target)) {
      closeModal();
      renderAll();
    }
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    store.init();
    currentUserId = localStorage.getItem('co-living-me');
    if (!currentUserId || !store.roommate(currentUserId)) {
      currentUserId = getState().roommates[0].id;
    }
    renderAll();

    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', closeModal);

    // 账单筛选
    ['fType', 'fMonth', 'fPayer', 'fStatus'].forEach(id => {
      document.getElementById(id).addEventListener('change', function (e) {
        billFilter[id.slice(1).toLowerCase()] = e.target.value;
        renderBills();
      });
    });
    document.getElementById('exportBtn').addEventListener('click', exportCsv);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
