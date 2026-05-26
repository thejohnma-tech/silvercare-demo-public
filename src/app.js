import { createAuthStore } from './auth.mjs';
import {
  buildTicket,
  getReminderStatus,
  replyToQuestion,
  servicePackages,
} from './core.mjs';
import {
  buildPublicDemoCredentials,
  createPublicDemoState,
  isPublicDemoRequest,
} from './demo.mjs';
import {
  buildLead,
  buildLeadCsv,
  buildWhatsappLink,
  getLeadStatusLabel,
  leadStatuses,
  updateLeadFollowUp,
} from './leads.mjs';
import {
  buildFollowUpTasks,
  buildFunnelMetrics,
  buildLaunchChecklist,
  resolveFollowUpTask,
} from './marketing.mjs';
import { buildOrder, createCheckoutProvider } from './payments.mjs';
import {
  buildPaidPilotDashboard,
  buildPilotFromLead,
} from './pilots.mjs';
import {
  addOutreachContact,
  markOutreachSent,
} from './outreach.mjs';
import { runtimeConfig } from './runtime-config.js';
import {
  buildStateBackup,
  createStateStore,
  getDefaultState,
  parseStateBackup,
} from './storage.mjs';

let authStore;
let session = { user: null, role: 'guest', mode: 'signed-out' };
let store;
let checkoutProvider;
let state = getDefaultState();

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(amount) {
  return new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function renderAuth(message = '') {
  const protectedWorkspace = document.querySelector('#protectedWorkspace');
  const authForm = document.querySelector('#authForm');
  const signedInRow = document.querySelector('#signedInRow');
  const signedInEmail = document.querySelector('#signedInEmail');
  const signedInMode = document.querySelector('#signedInMode');
  const authMessage = document.querySelector('#authMessage');
  const isSignedIn = Boolean(session.user);

  protectedWorkspace.hidden = !isSignedIn;
  authForm.hidden = isSignedIn;
  signedInRow.hidden = !isSignedIn;
  signedInEmail.textContent = isSignedIn ? session.user.email : '未登入';
  signedInMode.textContent = isSignedIn ? `${session.mode} / ${session.role}` : 'Guest';
  authMessage.textContent = message || (authStore?.mode === 'supabase'
    ? 'Supabase Auth 已啟用。'
    : '本機 demo 使用 PIN 2468；設定 Supabase 後可改用 email/password auth。');
}

function renderDashboard() {
  const revenue = state.orders
    .filter((order) => order.status === 'Paid')
    .reduce((sum, order) => sum + order.amount, 0);
  const dueCount = state.reminders.filter((reminder) => getReminderStatus(reminder.date) === 'Due').length;
  const metrics = [
    ['家庭', state.profile ? state.profile.name : '未建立檔案', '可建立照顧跟進'],
    ['月費收入', formatMoney(revenue), '模擬已付款訂單'],
    ['跟進事項', state.tickets.length, '已由付款流程建立'],
    ['到期提醒', dueCount, '需要跟進'],
  ];

  document.querySelector('#dashboard').innerHTML = metrics.map(([label, value, help]) => `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(help)}</small>
    </article>
  `).join('');
}

function renderFunnel() {
  const metrics = buildFunnelMetrics({
    outreachContacts: state.outreachContacts ?? [],
    leads: state.leads ?? [],
  });

  document.querySelector('#funnelGrid').innerHTML = metrics.map((metric) => `
    <article class="funnel-card ${metric.key.includes('Rate') ? 'rate-card' : ''}">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
      <small>${escapeHtml(metric.helper)}</small>
    </article>
  `).join('');
}

function renderFollowUps() {
  const tasks = buildFollowUpTasks({
    outreachContacts: state.outreachContacts ?? [],
    leads: state.leads ?? [],
  });
  document.querySelector('#followUpCount').textContent = `${tasks.length} items`;
  const list = document.querySelector('#followUpList');

  if (!tasks.length) {
    list.innerHTML = '<p class="empty-state">暫時無逾期跟進。今日可以繼續加入第一批 warm contacts。</p>';
    return;
  }

  list.innerHTML = tasks.map((task) => `
    <article class="follow-up-card">
      <div>
        <span class="status-pill ${task.priority === 'High' ? 'due' : ''}">${escapeHtml(task.dueLabel)}</span>
        <span class="priority">${escapeHtml(task.type)} / ${escapeHtml(task.priority)}</span>
      </div>
      <h4>${escapeHtml(task.title)}</h4>
      <p>${escapeHtml(task.detail)}</p>
      <small>${escapeHtml(task.contact)}</small>
      <button class="secondary-action" type="button" data-resolve-follow-up="${escapeHtml(task.id)}">標記已跟進</button>
    </article>
  `).join('');
}

function renderLaunchChecklist() {
  const items = buildLaunchChecklist({ config: runtimeConfig, state });
  const doneCount = items.filter((item) => item.done).length;
  document.querySelector('#launchStatus').textContent = `${doneCount} / ${items.length}`;
  document.querySelector('#launchChecklistGrid').innerHTML = items.map((item) => `
    <article class="checklist-card ${item.done ? 'done' : ''}">
      <span class="status-pill ${item.done ? '' : 'due'}">${item.done ? 'Ready' : 'Pending'}</span>
      <h4>${escapeHtml(item.label)}</h4>
      <p>${escapeHtml(item.helper)}</p>
    </article>
  `).join('');
}

function renderPaidPilots() {
  const dashboard = buildPaidPilotDashboard(state.paidPilots ?? []);
  document.querySelector('#paidPilotStatus').textContent = dashboard.recommendation;
  document.querySelector('#paidPilotMetrics').innerHTML = dashboard.metrics.map((metric) => `
    <article class="funnel-card">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
      <small>${escapeHtml(metric.helper)}</small>
    </article>
  `).join('');

  const list = document.querySelector('#paidPilotAlerts');
  if (!state.paidPilots?.length) {
    list.innerHTML = '<p class="empty-state">將 Trial lead 轉成 HK$99 paid pilot 後，會在這裡追蹤 7 日 check-in 和退款期限。</p>';
    return;
  }

  list.innerHTML = state.paidPilots.map((pilot) => `
    <article class="order-card">
      <div>
        <span class="status-pill ${pilot.day7Outcome ? '' : 'due'}">${escapeHtml(pilot.status)}</span>
        <span class="priority">${escapeHtml(pilot.day7Outcome || 'awaiting day-7')}</span>
      </div>
      <h4>${escapeHtml(pilot.customerName)}</h4>
      <p>HK$99 / 30 日 pilot · ${escapeHtml(pilot.whatsApp)}</p>
      <small>Start ${escapeHtml(pilot.pilotStartDate)} · Day-7 ${escapeHtml(pilot.day7CheckInDate)} · Refund until ${escapeHtml(pilot.refundDeadline)}</small>
      <form class="pilot-outcome-form" data-pilot-id="${escapeHtml(pilot.id)}">
        <label>
          Day-7 結果
          <select name="day7Outcome">
            <option value="" ${pilot.day7Outcome ? '' : 'selected'}>未跟進</option>
            <option value="continue" ${pilot.day7Outcome === 'continue' ? 'selected' : ''}>想繼續</option>
            <option value="needs-change" ${pilot.day7Outcome === 'needs-change' ? 'selected' : ''}>要改功能</option>
            <option value="refund" ${pilot.day7Outcome === 'refund' ? 'selected' : ''}>退款</option>
            <option value="no-reply" ${pilot.day7Outcome === 'no-reply' ? 'selected' : ''}>未回覆</option>
          </select>
        </label>
        <label>
          Pilot 備註
          <textarea name="notes" placeholder="例如：想繼續月費，最重視防騙提醒。">${escapeHtml(pilot.notes ?? '')}</textarea>
        </label>
        <button class="secondary-action" type="submit">更新 pilot</button>
      </form>
    </article>
  `).join('');
}

function renderStorageStatus(message = '') {
  const badge = document.querySelector('#storageStatus');
  const detail = document.querySelector('#storageDetail');
  const isCloud = store?.mode?.startsWith('supabase');
  badge.textContent = isCloud ? 'Supabase 雲端' : '本機 localStorage';
  detail.textContent = message || (isCloud
    ? '已連接 normalized tables'
    : '未設定 Supabase，仍可本機示範');
}

function renderCheckoutStatus(message = '') {
  const status = document.querySelector('#checkoutStatus');
  if (!status) return;
  status.textContent = message || (checkoutProvider?.mode === 'stripe'
    ? 'Stripe 待接駁'
    : '模擬付款');
}

function renderLeadStatus(message = '') {
  const status = document.querySelector('#leadStatus');
  if (!status) return;
  status.textContent = message || 'Ready';
}

function renderPlans() {
  document.querySelector('#plansGrid').innerHTML = servicePackages.map((plan) => `
    <button class="plan-card ${plan.id === state.selectedPackageId ? 'selected' : ''}" type="button" data-plan-id="${escapeHtml(plan.id)}">
      <span>${escapeHtml(plan.cadence)}</span>
      <strong>${escapeHtml(plan.name)}</strong>
      <em>${formatMoney(plan.price)}</em>
      <small>${escapeHtml(plan.summary)}</small>
    </button>
  `).join('');
}

function renderOrders() {
  const list = document.querySelector('#orderList');
  if (!state.orders.length) {
    list.innerHTML = '<p class="empty-state">完成付款流程後，系統會保留一張訂單紀錄。</p>';
    return;
  }

  list.innerHTML = state.orders.map((order) => `
    <article class="order-card">
      <div>
        <span class="status-pill">${escapeHtml(order.status)}</span>
        <span class="priority">${escapeHtml(order.provider)}</span>
      </div>
      <h4>${escapeHtml(order.packageName)}</h4>
      <p>${formatMoney(order.amount)} · ${escapeHtml(order.customerEmail)}</p>
      <small>${escapeHtml(order.id)} / ${order.paidAt ? new Date(order.paidAt).toLocaleString('zh-HK') : 'Pending'}</small>
    </article>
  `).join('');
}

function renderLeads() {
  const list = document.querySelector('#leadList');
  if (!state.leads.length) {
    list.innerHTML = '<p class="empty-state">公開收客表單提交後，查詢會顯示在這裡。</p>';
    return;
  }

  list.innerHTML = state.leads.map((lead) => `
    <article class="lead-card" data-lead-id="${escapeHtml(lead.id)}">
      <div>
        <span class="status-pill">${escapeHtml(getLeadStatusLabel(lead.status))}</span>
        <span class="priority">${escapeHtml(lead.source)}</span>
      </div>
      <h4>${escapeHtml(lead.name)}</h4>
      <p>${escapeHtml(lead.whatsapp)} · ${escapeHtml(lead.preferredPlan)}</p>
      <small>${escapeHtml(lead.painPoint)}</small>
      <form class="lead-follow-up" data-lead-id="${escapeHtml(lead.id)}">
        <label>
          跟進狀態
          <select name="status">
            ${leadStatuses.map((status) => `
              <option value="${escapeHtml(status)}" ${lead.status === status ? 'selected' : ''}>${escapeHtml(getLeadStatusLabel(status))}</option>
            `).join('')}
          </select>
        </label>
        <label>
          跟進備註
          <textarea name="followUpNote" placeholder="例如：已 WhatsApp，約星期五試用。">${escapeHtml(lead.followUpNote ?? '')}</textarea>
        </label>
        <div class="lead-actions">
          <a class="secondary-action" href="${escapeHtml(buildWhatsappLink(lead))}" target="_blank" rel="noreferrer">WhatsApp</a>
          <button class="secondary-action" type="button" data-create-pilot="${escapeHtml(lead.id)}">Create HK$99 pilot</button>
          <button class="primary-action" type="submit">更新跟進</button>
        </div>
      </form>
    </article>
  `).join('');
}

function renderOutreach() {
  const count = document.querySelector('#outreachCount');
  const list = document.querySelector('#outreachList');
  const contacts = state.outreachContacts ?? [];
  count.textContent = `${contacts.length} / 15`;

  if (!contacts.length) {
    list.innerHTML = '<p class="empty-state">先加入 15 個可以真實聯絡的人，逐個發 demo 試用訊息。</p>';
    return;
  }

  list.innerHTML = contacts.map((contact) => `
    <article class="outreach-card" data-contact-id="${escapeHtml(contact.id)}">
      <div>
        <span class="status-pill">${escapeHtml(contact.status === 'Sent' ? '已發送' : '待發送')}</span>
        <span class="priority">#${escapeHtml(contact.number)} ${escapeHtml(contact.segment)}</span>
      </div>
      <h4>${escapeHtml(contact.name)}</h4>
      <p>${escapeHtml(contact.phone || '未填 WhatsApp')}</p>
      <textarea readonly>${escapeHtml(contact.message)}</textarea>
      <div class="lead-actions">
        ${contact.whatsappLink ? `<a class="secondary-action" href="${escapeHtml(contact.whatsappLink)}" target="_blank" rel="noreferrer">開 WhatsApp</a>` : ''}
        <button class="primary-action" type="button" data-mark-sent="${escapeHtml(contact.id)}" ${contact.status === 'Sent' ? 'disabled' : ''}>標記已發送</button>
      </div>
      ${contact.sentAt ? `<small>已發送：${new Date(contact.sentAt).toLocaleString('zh-HK')}</small>` : ''}
    </article>
  `).join('');
}

function renderTickets() {
  const list = document.querySelector('#ticketList');
  if (!state.tickets.length) {
    list.innerHTML = '<p class="empty-state">付款後會自動建立第一張家庭跟進事項。</p>';
    return;
  }

  list.innerHTML = state.tickets.map((ticket) => `
    <article class="ticket-card">
      <div>
        <span class="status-pill">${escapeHtml(ticket.status)}</span>
        <span class="priority ${ticket.priority.toLowerCase()}">${escapeHtml(ticket.priority)}</span>
      </div>
      <h4>${escapeHtml(ticket.packageName)}</h4>
      <p>${escapeHtml(ticket.concern)}</p>
      <ul>${ticket.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <small>${escapeHtml(ticket.id)} / ${new Date(ticket.createdAt).toLocaleString('zh-HK')}</small>
    </article>
  `).join('');
}

function renderChat() {
  document.querySelector('#chatWindow').innerHTML = state.chat.map((message) => `
    <div class="chat-bubble ${escapeHtml(message.role)}">
      ${escapeHtml(message.text)}
    </div>
  `).join('');
}

function renderReminders() {
  const list = document.querySelector('#reminderList');
  if (!state.reminders.length) {
    list.innerHTML = '<p class="empty-state">加入提醒後，系統會標示 Scheduled 或 Due。</p>';
    return;
  }

  list.innerHTML = state.reminders.map((reminder) => {
    const status = getReminderStatus(reminder.date);
    return `
      <article class="reminder-row">
        <div>
          <strong>${escapeHtml(reminder.title)}</strong>
          <small>${escapeHtml(reminder.date)}</small>
        </div>
        <span class="status-pill ${status === 'Due' ? 'due' : ''}">${escapeHtml(status)}</span>
      </article>
    `;
  }).join('');
}

function renderProfile() {
  const panel = document.querySelector('#loginPanel');
  if (!state.profile) {
    panel.classList.remove('signed-in');
    panel.querySelector('h3').textContent = '建立家庭照顧檔案';
    panel.querySelector('.eyebrow').textContent = '家庭資料';
    return;
  }

  panel.classList.add('signed-in');
  panel.querySelector('h3').textContent = `${state.profile.name} 已登入`;
  panel.querySelector('.eyebrow').textContent = `${state.profile.relationship} / ${state.profile.phone}`;
}

function renderAll() {
  renderAuth();
  renderProfile();
  renderDashboard();
  renderFunnel();
  renderFollowUps();
  renderLaunchChecklist();
  renderPaidPilots();
  renderPlans();
  renderOrders();
  renderLeads();
  renderOutreach();
  renderTickets();
  renderChat();
  renderReminders();
}

function downloadTextFile(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelector('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);

  try {
    session = await authStore.signIn({
      email: data.get('email'),
      pin: data.get('secret'),
      password: data.get('secret'),
    });
    event.currentTarget.reset();
    renderAll();
    renderAuth('已登入工作台。');
  } catch (error) {
    renderAuth(`登入失敗：${error.message}`);
  }
});

document.querySelector('#leadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);

  try {
    const lead = buildLead({
      name: data.get('name'),
      whatsapp: data.get('whatsapp'),
      painPoint: data.get('painPoint'),
      preferredPlan: data.get('preferredPlan'),
      consent: data.get('consent') === 'on',
    });
    state.leads.unshift(lead);
    event.currentTarget.reset();
    await persistState();
    renderAll();
    renderLeadStatus('已收到查詢');
  } catch (error) {
    renderLeadStatus(`提交失敗：${error.message}`);
  }
});

document.querySelector('#leadList').addEventListener('submit', async (event) => {
  const form = event.target.closest('.lead-follow-up');
  if (!form) return;
  event.preventDefault();

  const data = new FormData(form);
  state.leads = updateLeadFollowUp(state.leads, form.dataset.leadId, {
    status: data.get('status'),
    followUpNote: data.get('followUpNote'),
  });
  await persistState();
  renderAll();
});

document.querySelector('#leadList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-create-pilot]');
  if (!button) return;
  const lead = (state.leads ?? []).find((item) => item.id === button.dataset.createPilot);
  if (!lead) return;

  const alreadyExists = (state.paidPilots ?? []).some((pilot) => pilot.source === lead.id);
  if (!alreadyExists) {
    state.paidPilots = [
      buildPilotFromLead({ lead }),
      ...(state.paidPilots ?? []),
    ];
  }
  state.leads = updateLeadFollowUp(state.leads, lead.id, {
    status: 'Trial',
    followUpNote: lead.followUpNote || 'Created HK$99 paid pilot.',
  });
  await persistState();
  renderAll();
});

document.querySelector('#exportLeadsButton').addEventListener('click', () => {
  downloadTextFile('silvercare-leads.csv', buildLeadCsv(state.leads));
});

document.querySelector('#exportBackupButton').addEventListener('click', () => {
  downloadTextFile(
    `silvercare-backup-${new Date().toISOString().slice(0, 10)}.json`,
    buildStateBackup(state),
    'application/json;charset=utf-8',
  );
});

document.querySelector('#importBackupButton').addEventListener('click', () => {
  document.querySelector('#importBackupInput').click();
});

document.querySelector('#importBackupInput').addEventListener('change', async (event) => {
  const [file] = event.currentTarget.files;
  if (!file) return;

  try {
    const backup = parseStateBackup(await file.text());
    state = backup.state;
    await persistState();
    renderAll();
    renderStorageStatus(`已匯入備份：${backup.exportedAt}`);
  } catch (error) {
    renderStorageStatus(`匯入失敗：${error.message}`);
  } finally {
    event.currentTarget.value = '';
  }
});

document.querySelector('#outreachForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.outreachContacts = addOutreachContact(state.outreachContacts ?? [], {
    name: data.get('name'),
    phone: data.get('phone'),
    segment: data.get('segment'),
    publicUrl: window.location.origin,
  });
  event.currentTarget.reset();
  await persistState();
  renderAll();
});

document.querySelector('#outreachList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-mark-sent]');
  if (!button) return;
  state.outreachContacts = markOutreachSent(state.outreachContacts ?? [], button.dataset.markSent);
  await persistState();
  renderAll();
});

document.querySelector('#followUpList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-resolve-follow-up]');
  if (!button) return;
  const resolved = resolveFollowUpTask({
    taskId: button.dataset.resolveFollowUp,
    outreachContacts: state.outreachContacts ?? [],
    leads: state.leads ?? [],
  });
  state.outreachContacts = resolved.outreachContacts;
  state.leads = resolved.leads;
  await persistState();
  renderAll();
});

document.querySelector('#signOutButton').addEventListener('click', async () => {
  session = await authStore.signOut();
  renderAll();
  renderAuth('已登出。');
});

document.querySelector('#profileForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.profile = Object.fromEntries(data.entries());
  persistState();
  renderAll();
});

document.querySelector('#plansGrid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-plan-id]');
  if (!card) return;
  state.selectedPackageId = card.dataset.planId;
  persistState();
  renderPlans();
});

document.querySelector('#checkoutForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.profile) {
    alert('請先建立家庭照顧檔案。');
    return;
  }

  const data = new FormData(event.currentTarget);
  renderCheckoutStatus('付款處理中');

  const order = buildOrder({
    customerEmail: state.profile.email,
    packageId: state.selectedPackageId,
  });
  const paidOrder = await checkoutProvider.checkout(order);
  state.orders.unshift(paidOrder);

  const ticket = buildTicket({
    customerName: state.profile.name,
    packageId: state.selectedPackageId,
    concern: data.get('concern'),
  });
  state.tickets.unshift(ticket);
  event.currentTarget.reset();
  persistState();
  renderAll();
  renderCheckoutStatus('付款成功，工單已建立');
});

document.querySelector('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const question = data.get('question').trim();
  state.chat.push({ role: 'user', text: question });
  state.chat.push({ role: 'bot', text: replyToQuestion(question) });
  event.currentTarget.reset();
  persistState();
  renderChat();
});

document.querySelector('#reminderForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.reminders.unshift({
    id: `REM-${Date.now().toString(36).toUpperCase()}`,
    title: data.get('title').trim(),
    date: data.get('date'),
  });
  event.currentTarget.reset();
  persistState();
  renderAll();
});

document.querySelector('#resetDemo').addEventListener('click', async () => {
  await store.reset();
  state = getDefaultState();
  renderAll();
  renderStorageStatus('Demo 資料已重設');
});

async function persistState() {
  try {
    await store.save(state);
    renderStorageStatus('已儲存 demo 狀態');
  } catch (error) {
    renderStorageStatus(`儲存失敗：${error.message}`);
  }
}

async function boot() {
  try {
    const publicDemo = isPublicDemoRequest(window.location.search);
    authStore = await createAuthStore(runtimeConfig);
    session = await authStore.getSession();
    if (publicDemo && !session.user) {
      session = await authStore.signIn(buildPublicDemoCredentials(runtimeConfig));
    }

    checkoutProvider = createCheckoutProvider(runtimeConfig);
    store = await createStateStore(runtimeConfig);
    state = await store.load();
    if (publicDemo) {
      state = createPublicDemoState(state);
      await store.save(state);
    }

    renderAll();
    renderStorageStatus(publicDemo ? '公開 demo 模式已啟用，可直接試用流程。' : '');
    renderCheckoutStatus();
    renderLeadStatus();
  } catch (error) {
    authStore = await createAuthStore({});
    session = await authStore.getSession();
    checkoutProvider = createCheckoutProvider({});
    store = await createStateStore({});
    state = await store.load();
    renderAll();
    renderStorageStatus(`雲端連接失敗，已回到本機 demo：${error.message}`);
    renderCheckoutStatus();
    renderLeadStatus();
  }
}

boot();
