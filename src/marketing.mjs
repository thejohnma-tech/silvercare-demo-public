export const landingHero = {
  headline: '在外子女也能安心跟進父母日常',
  subhead: '為香港家庭自動整理防騙、覆診、食藥、付款和跟進事項，先用零固定月費 MVP 跑通收客流程。',
  primaryCta: {
    label: '試用工作台',
    href: '#authPanel',
  },
  secondaryCta: {
    label: '查看月費方案',
    href: '#plans',
  },
};

export const landingBenefits = [
  {
    title: '防騙先行',
    body: '先拒絕 OTP、銀行資料、轉帳指示和投資建議，疑似詐騙提醒用戶致電 18222。',
  },
  {
    title: '付款到工單',
    body: '月費方案付款後自動建立客戶、訂單、工單和提醒，方便遠程營運。',
  },
  {
    title: '適合遠程營運',
    body: '本地 demo 可免費運作，之後接 Supabase、Stripe、WhatsApp 和 AI API 逐步升級。',
  },
];

export const landingMetrics = [
  {
    value: 'HK$0',
    label: '固定月費起步',
  },
  {
    value: '3',
    label: '月費方案',
  },
  {
    value: '18222',
    label: '防騙熱線提示',
  },
];

function percent(numerator, denominator) {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function daysBetween(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.floor((to - from) / 86_400_000);
}

export function buildFunnelMetrics({ outreachContacts = [], leads = [] }) {
  const contacts = outreachContacts.length;
  const sent = outreachContacts.filter((contact) => contact.status === 'Sent').length;
  const leadCount = leads.length;
  const trial = leads.filter((lead) => lead.status === 'Trial').length;
  const converted = leads.filter((lead) => lead.status === 'Converted').length;

  return [
    { key: 'contacts', label: '名單', value: contacts, helper: '第一批 warm contacts' },
    { key: 'sent', label: '已發送', value: sent, helper: 'WhatsApp demo 訊息' },
    { key: 'leads', label: '收到查詢', value: leadCount, helper: 'Landing page lead capture' },
    { key: 'trial', label: '試用中', value: trial, helper: '已安排試用或 demo' },
    { key: 'converted', label: '已成交', value: converted, helper: '付費或承諾付費' },
    { key: 'sentRate', label: '發送率', value: percent(sent, contacts), helper: '已發送 / 名單' },
    { key: 'leadRate', label: '查詢率', value: percent(leadCount, sent), helper: '查詢 / 已發送' },
    { key: 'closeRate', label: '成交率', value: percent(converted, leadCount), helper: '成交 / 查詢' },
  ];
}

export function buildFollowUpTasks({
  outreachContacts = [],
  leads = [],
  now = new Date().toISOString(),
}) {
  const outreachTasks = outreachContacts
    .filter((contact) => contact.status === 'Sent' && contact.sentAt && daysBetween(contact.sentAt, now) >= 2)
    .map((contact) => ({
      id: `TASK-${contact.id}`,
      type: 'Outreach',
      priority: 'Medium',
      title: `追問 ${contact.name}`,
      detail: 'WhatsApp demo 已發出 2 日，未有新查詢就追一次。',
      contact: contact.phone,
      dueLabel: '今日要追',
    }));

  const leadTasks = leads
    .filter((lead) => !['Converted', 'Lost'].includes(lead.status))
    .filter((lead) => daysBetween(lead.updatedAt ?? lead.createdAt, now) >= 3)
    .map((lead) => ({
      id: `TASK-${lead.id}`,
      type: 'Lead',
      priority: lead.status === 'Trial' ? 'High' : 'Medium',
      title: `跟進 ${lead.name}`,
      detail: '查詢 3 日未更新，建議 WhatsApp 或安排試用。',
      contact: lead.whatsapp,
      dueLabel: '已逾 3 日',
    }));

  return [...leadTasks, ...outreachTasks];
}

export function resolveFollowUpTask({
  taskId,
  outreachContacts = [],
  leads = [],
  now = new Date().toISOString(),
}) {
  const recordId = taskId.replace(/^TASK-/, '');

  return {
    outreachContacts: outreachContacts.map((contact) => (contact.id === recordId ? {
      ...contact,
      sentAt: now,
    } : contact)),
    leads: leads.map((lead) => {
      if (lead.id !== recordId) return lead;
      const previousNote = lead.followUpNote?.trim();
      return {
        ...lead,
        followUpNote: previousNote ? `${previousNote}\n已跟進：${now}` : `已跟進：${now}`,
        updatedAt: now,
      };
    }),
  };
}

export function buildLaunchChecklist({ config = {}, state = {} }) {
  const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const outreachContacts = state.outreachContacts ?? [];
  const leads = state.leads ?? [];
  const orders = state.orders ?? [];

  return [
    {
      key: 'supabase',
      label: 'Supabase 雲端儲存',
      done: hasSupabase,
      helper: hasSupabase ? '已設定雲端資料庫' : '未設定時只會存在本機 browser',
    },
    {
      key: 'leadCapture',
      label: 'Lead capture 表單',
      done: leads.length > 0,
      helper: '已收到至少一個試用查詢',
    },
    {
      key: 'outreach',
      label: '第一批客 outreach',
      done: outreachContacts.some((contact) => contact.status === 'Sent'),
      helper: '已發出至少一個 WhatsApp demo',
    },
    {
      key: 'trialPipeline',
      label: '試用 pipeline',
      done: leads.some((lead) => lead.status === 'Trial' || lead.status === 'Converted'),
      helper: '已有查詢進入試用或成交階段',
    },
    {
      key: 'paymentFlow',
      label: '付款到工單流程',
      done: orders.some((order) => order.status === 'Paid'),
      helper: '已跑過付款模擬或實際付款',
    },
    {
      key: 'safetyPolicy',
      label: '安全政策',
      done: true,
      helper: '已拒收 OTP、銀行資料、醫療診斷和投資建議',
    },
  ];
}
