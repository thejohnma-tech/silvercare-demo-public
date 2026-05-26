function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function dateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(dateValue, today) {
  const target = dateOnly(dateValue);
  if (!target) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function customerLabel(row) {
  return row.customerName || row.whatsApp || row.email || 'Unnamed pilot';
}

const pilotTrackerColumns = [
  'customerName',
  'whatsApp',
  'email',
  'source',
  'paidHkd99',
  'paymentMethod',
  'paymentReceivedAt',
  'pilotStartDate',
  'refundDeadline',
  'careContext',
  'topConcern',
  'workspaceReady',
  'firstThreeTasks',
  'dashboardLinkSent',
  'day7CheckInDate',
  'day7Outcome',
  'status',
  'notes',
];

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function addDays(dateValue, days) {
  const date = dateOnly(dateValue);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildPilotFromLead({ lead, startDate = new Date().toISOString().slice(0, 10) }) {
  return {
    id: `PILOT-${lead.id || Date.now()}`,
    customerName: lead.name || '',
    whatsApp: lead.whatsApp || lead.whatsapp || '',
    email: lead.email || '',
    source: lead.source || lead.id || '',
    paidHkd99: 'yes',
    paymentMethod: '',
    paymentReceivedAt: startDate,
    pilotStartDate: startDate,
    refundDeadline: addDays(startDate, 7),
    careContext: lead.relationship || '',
    topConcern: lead.painPoint || '',
    workspaceReady: 'no',
    firstThreeTasks: '',
    dashboardLinkSent: 'no',
    day7CheckInDate: addDays(startDate, 7),
    day7Outcome: '',
    status: 'active',
    notes: '',
  };
}

export function updatePilotOutcome(rows, pilotId, updates) {
  return rows.map((row) => {
    if (row.id !== pilotId) return row;
    const day7Outcome = updates.day7Outcome ?? row.day7Outcome;
    const status = day7Outcome === 'continue'
      ? 'converted'
      : day7Outcome === 'refund'
        ? 'refunded'
        : row.status;
    return {
      ...row,
      ...updates,
      status,
    };
  });
}

export function buildPilotTrackerCsv(rows) {
  return [
    pilotTrackerColumns.join(','),
    ...rows.map((row) => pilotTrackerColumns.map((column) => csvValue(row[column])).join(',')),
  ].join('\n');
}

export function analyzePaidPilots(rows, today = new Date()) {
  const paidRows = rows.filter((row) => normalized(row.paidHkd99) === 'yes');
  const activeRows = paidRows.filter((row) => ['paid', 'active'].includes(normalized(row.status)));
  const dueCheckIns = activeRows.filter((row) => {
    const outcome = normalized(row.day7Outcome);
    const remainingDays = daysUntil(row.day7CheckInDate, today);
    return !outcome && remainingDays !== null && remainingDays <= 0;
  });
  const refundRisk = activeRows.filter((row) => {
    const remainingDays = daysUntil(row.refundDeadline, today);
    return remainingDays !== null && remainingDays >= 0 && remainingDays <= 2;
  });
  const continueCount = paidRows.filter((row) => normalized(row.day7Outcome) === 'continue').length;

  let recommendation = 'keep-selling';
  if (continueCount > 0) {
    recommendation = 'convert';
  } else if (dueCheckIns.length > 0 || refundRisk.length > 0) {
    recommendation = 'follow-up';
  }

  return {
    recommendation,
    paidCount: paidRows.length,
    activeCount: activeRows.length,
    continueCount,
    dueCheckIns,
    refundRisk,
  };
}

export function buildPaidPilotReport(rows, today = new Date()) {
  const result = analyzePaidPilots(rows, today);
  const dueNames = result.dueCheckIns.map(customerLabel);
  const refundNames = result.refundRisk.map(customerLabel);

  return [
    '# SilverCare Paid Pilot Report',
    '',
    `Recommendation: ${result.recommendation}`,
    `Paid pilots: ${result.paidCount}`,
    `Active pilots: ${result.activeCount}`,
    `Wants to continue: ${result.continueCount}`,
    `7-day check-ins due: ${dueNames.length ? dueNames.join(', ') : 'none'}`,
    `Refund deadlines within 2 days: ${refundNames.length ? refundNames.join(', ') : 'none'}`,
    '',
    result.recommendation === 'convert'
      ? 'Next step: ask continuing pilots to move from the 30-day paid pilot into a monthly plan.'
      : 'Next step: follow up active pilots before adding more product features.',
  ].join('\n');
}

export function buildPaidPilotDashboard(rows, today = new Date()) {
  const result = analyzePaidPilots(rows, today);
  const paidRows = rows.filter((row) => normalized(row.paidHkd99) === 'yes');
  const activeRows = paidRows.filter((row) => ['paid', 'active'].includes(normalized(row.status)));
  const alerts = [
    ...result.dueCheckIns.map((pilot) => ({
      customerName: customerLabel(pilot),
      status: pilot.status || 'active',
      action: '7-day check-in due',
    })),
    ...result.refundRisk.map((pilot) => ({
      customerName: customerLabel(pilot),
      status: pilot.status || 'active',
      action: `Refund deadline ${pilot.refundDeadline}`,
    })),
  ];

  return {
    recommendation: result.recommendation,
    metrics: [
      { label: 'Paid pilots', value: paidRows.length, helper: 'HK$99 trials started' },
      { label: 'Active', value: activeRows.length, helper: 'Needs onboarding or support' },
      { label: 'Follow-up due', value: result.dueCheckIns.length, helper: '7-day check-ins waiting' },
      { label: 'Refund risk', value: result.refundRisk.length, helper: 'Deadline within 2 days' },
    ],
    pilots: paidRows.map((pilot) => ({
      customerName: customerLabel(pilot),
      status: pilot.status || 'active',
      action: pilot.day7Outcome === 'continue' ? 'Ready to convert' : 'Paid pilot active',
    })),
    alerts,
  };
}
