/* ============================================================
   app.js · 渲染、交互、弹窗表单
   ============================================================ */
window.SH = window.SH || {};
(function () {
  const store = SH.store;
  const calc = SH.calc;
  const U = SH.utils;

  let currentUserId = null;

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

    // 待结算
    const transfers = calc.settle(s.roommates, bills);
    const pending = transfers.reduce((a, t) => a + t.amount, 0);
    document.getElementById('statSettle').textContent = U.fmtMoney(pending);

    // 值日待办
    const pendingDuties = s.dutyTasks.filter(t => isPending(t.id));
    const doneDuties = s.dutyTasks.filter(t => !isPending(t.id));
    const dutyEl = document.getElementById('homeDuty');
    if (!pendingDuties.length) {
      dutyEl.innerHTML = `<div class="card empty">🎉 本周值日全部完成</div>`;
    } else {
      dutyEl.innerHTML = pendingDuties.slice(0, 4).map(t => {
        const rid = s.schedule.assignments[t.id];
        return `<div class="card duty-item">
          <span class="duty-emoji">${esc(t.emoji)}</span>
          <div class="duty-main">
            <div class="duty-name">${esc(t.name)}</div>
            <div class="duty-assign"><b>${esc(store.roommateName(rid))}</b> · ${esc(t.freq)}</div>
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
    const bills = s.bills;

    const monthStart = U.monthStartISO();
    const monthBills = bills.filter(b => b.date >= monthStart);
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

    // 结算
    const transfers = calc.settle(s.roommates, bills);
    const pending = transfers.reduce((a, t) => a + t.amount, 0);
    const panel = document.getElementById('settlePanel');
    if (!transfers.length) {
      panel.className = 'settle-panel settled';
      panel.innerHTML = `<div class="settle-title">✅ 费用已全部结清</div>`;
    } else {
      panel.className = 'settle-panel';
      panel.innerHTML = `
        <div class="settle-title">待结算 <span class="mono">${U.fmtMoney(pending)}</span></div>
        ${transfers.map(t => `
          <div class="settle-item">
            <span>${esc(store.roommateName(t.from))} → ${esc(store.roommateName(t.to))}</span>
            <span class="amount owe">${U.fmtMoney(t.amount)}</span>
          </div>`).join('')}`;
    }

    // 账单列表
    document.getElementById('billCount').textContent = `${bills.length} 笔`;
    document.getElementById('billList').innerHTML = bills.length
      ? bills.map(b => {
        const t = store.billType(b.type);
        return `<div class="card bill-card">
          <div class="bill-ico">${esc(t.emoji)}</div>
          <div class="bill-main">
            <div class="bill-title">${t.label}${b.note ? ' · ' + esc(b.note) : ''}</div>
            <div class="bill-sub">${U.fmtDate(b.date)} · ${esc(store.roommateName(b.payerId))} 垫付 · ${esc(splitModeLabel(b))} ${b.splitIds.length}人</div>
          </div>
          <div class="bill-amt">
            <div class="mono">${U.fmtMoney(b.amount)}</div>
            <button class="ghost-btn bill-delete" data-action="delBill" data-id="${b.id}" title="删除">删除</button>
          </div>
        </div>`;
      }).join('')
      : `<div class="card empty">还没有账单，点右上角「记一笔」开始</div>`;
  }

  function splitModeLabel(b) {
    if (b.splitMode === 'custom') return '自定义比例';
    if (b.splitMode === 'head') return '按人头';
    return '均摊';
  }

  /* ---- 值日 ---- */
  function isPending(taskId) {
    const s = getState();
    const task = s.dutyTasks.find(t => t.id === taskId);
    const doneDate = s.schedule.done[taskId];
    if (!doneDate) return true;
    if (task && task.freq === '每天') return doneDate !== U.todayISO();
    return doneDate < s.schedule.weekStart || doneDate > s.schedule.weekEnd;
  }

  function renderDuty() {
    const s = getState();
    document.getElementById('weekBanner').innerHTML =
      `本周排班 <span class="mono">${U.fmtDate(s.schedule.weekStart)} ~ ${U.fmtDate(s.schedule.weekEnd)}</span>`;

    const doneCount = s.dutyTasks.filter(t => !isPending(t.id)).length;
    document.getElementById('dutyList').innerHTML = s.dutyTasks.length
      ? s.dutyTasks.map(t => {
        const rid = s.schedule.assignments[t.id];
        const done = !isPending(t.id);
        return `<div class="duty-item ${done ? 'done' : ''}">
          <span class="duty-emoji">${esc(t.emoji)}</span>
          <div class="duty-main">
            <div class="duty-name">${esc(t.name)}</div>
            <div class="duty-assign">
              <button class="assign-link" data-action="assign" data-id="${t.id}">${esc(store.roommateName(rid))} ▾</button>
              <span>· ${esc(t.freq)}</span>
              ${done ? '<span class="tag ok" style="margin-left:6px">已完成</span>' : ''}
            </div>
          </div>
          <button class="duty-check" data-action="toggleDone" data-id="${t.id}" aria-label="完成">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
        </div>`;
      }).join('')
      : `<div class="card empty">还没有清洁任务，点右上角「添加任务」</div>`;

    // 任务管理
    document.getElementById('taskList').innerHTML = s.dutyTasks.length
      ? s.dutyTasks.map(t => `
        <div class="card task-item">
          <div class="task-left">
            <span class="task-emoji">${esc(t.emoji)}</span>
            <div>
              <div class="task-name">${esc(t.name)}</div>
              <div class="task-freq">${esc(t.freq)}</div>
            </div>
          </div>
          <button class="ghost-btn danger" data-action="delTask" data-id="${t.id}">删除</button>
        </div>`).join('')
      : '';
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
    const backdrop = document.getElementById('modalBackdrop');
    const modal = document.getElementById('modal');
    backdrop.hidden = false;
    modal.hidden = false;

    modal._onSubmit = onSubmit;
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
      const amount = parseFloat(form.amount.value);
      if (!amount || amount <= 0) { toast('请输入有效金额'); return false; }
      const splitIds = [...document.querySelectorAll('#splitChips .chip.is-on')].map(c => c.dataset.id);
      if (!splitIds.length) { toast('请至少选择一位参与人'); return false; }
      const mode = form.splitMode.value;
      let weights = null;
      if (mode === 'custom') {
        weights = {};
        splitIds.forEach(id => {
          const w = parseFloat(document.querySelector(`input[name="w_${id}"]`).value) || 0;
          weights[id] = w;
        });
        if (splitIds.every(id => !weights[id])) { toast('请填写有效的分摊比例'); return false; }
      }
      store.addBill({
        type: form.type.value,
        amount: Math.round(amount * 100) / 100,
        payerId: form.payer.value,
        splitMode: mode,
        splitIds,
        splitWeights: weights,
        date: form.date.value,
        note: form.note.value.trim()
      });
      toast('账单已记录');
      return true;
    });

    // 交互：分摊方式切换 + 参与人切换
    const splitMode = document.querySelector('[name="splitMode"]');
    const chipGroup = document.getElementById('splitChips');
    function refreshCustom() {
      const box = document.getElementById('customWeights');
      const mode = splitMode.value;
      if (mode !== 'custom') { box.hidden = true; box.innerHTML = ''; return; }
      const ids = [...chipGroup.querySelectorAll('.chip.is-on')].map(c => c.dataset.id);
      box.hidden = false;
      box.innerHTML = `<label>自定义比例（权重）</label>` + ids.map(id => {
        const r = store.roommate(id);
        return `<div class="field-row" style="margin-top:8px;align-items:center">
          <div class="field" style="flex:1;margin:0"><label style="font-weight:500;color:var(--ink)">${esc(r.name)}</label></div>
          <div class="field" style="flex:1;margin:0"><input class="mono" name="w_${id}" type="number" step="0.1" min="0" value="1"></div>
        </div>`;
      }).join('');
    }
    splitMode.addEventListener('change', refreshCustom);
    chipGroup.addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      chip.classList.toggle('is-on');
      refreshCustom();
    });
  }

  function openDutyForm() {
    openModal('添加清洁任务', `
      <form id="dutyForm">
        <div class="field-row">
          <div class="field"><label>图标</label><input name="emoji" value="🧹" maxlength="4"></div>
          <div class="field"><label>任务名称</label><input name="name" placeholder="如：客厅清扫" required></div>
        </div>
        <div class="field"><label>频率</label><select name="freq"><option>每天</option><option>每周</option></select></div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" data-close>取消</button>
          <button type="submit" class="primary-btn">添加</button>
        </div>
      </form>
    `, function (form) {
      store.addDutyTask({ emoji: form.emoji.value.trim() || '🧹', name: form.name.value.trim(), freq: form.freq.value });
      toast('任务已添加');
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
    toggleDone(id) { store.toggleDone(id); renderHome(); renderDuty(); },
    delTask(id) { if (confirm('删除该清洁任务？')) { store.removeDutyTask(id); renderAll(); } },
    assign(id) { openAssignForm(id); },
    confirmAssign(id) {
      const chip = document.querySelector('#assignChips .chip.is-on');
      if (!chip) { toast('请选择一位室友'); return; }
      store.setAssignment(id, chip.dataset.id);
      closeModal(); renderHome(); renderDuty(); toast('已重新指派');
    },
    rotate() { store.rotate(); renderHome(); renderDuty(); toast('已轮换到下周排班'); },

    // 账单
    addBill() { openBillForm(); },
    delBill(id) { if (confirm('删除这笔账单？')) { store.removeBill(id); renderAll(); } },

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
    // 关闭按钮
    if (e.target.closest('[data-close]')) { closeModal(); return; }

    const tab = e.target.closest('[data-tab]');
    if (tab) { switchTab(tab.dataset.tab); return; }
    const goto = e.target.closest('[data-goto]');
    if (goto) { switchTab(goto.dataset.goto); return; }

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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
