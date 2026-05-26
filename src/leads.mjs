export const leadStatuses = ['New', 'Contacted', 'Trial', 'Converted', 'Lost'];

export function buildLead({ name, whatsapp, painPoint, preferredPlan, consent }) {
  if (!consent) {
    throw new Error('Lead consent is required before collecting contact details');
  }

  const cleanedWhatsapp = whatsapp.trim();
  if (!/^\+?852\s?\d{4}\s?\d{4}$/.test(cleanedWhatsapp)) {
    throw new Error('WhatsApp must be a Hong Kong number, for example +852 9000 1111');
  }

  const now = new Date().toISOString();
  return {
    id: `LEAD-${Date.now().toString(36).toUpperCase()}`,
    name: name.trim(),
    whatsapp: cleanedWhatsapp,
    painPoint: painPoint.trim(),
    preferredPlan,
    status: 'New',
    followUpNote: '',
    source: 'landing',
    consentAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function getLeadStatusLabel(status) {
  return {
    New: '新查詢',
    Contacted: '已聯絡',
    Trial: '試用中',
    Converted: '已成交',
    Lost: '已失去',
  }[status] ?? status;
}

export function updateLeadFollowUp(leads, leadId, { status, followUpNote }) {
  if (!leadStatuses.includes(status)) {
    throw new Error(`Unknown lead status: ${status}`);
  }

  return leads.map((lead) => (lead.id === leadId ? {
    ...lead,
    status,
    followUpNote: followUpNote.trim(),
    updatedAt: new Date().toISOString(),
  } : lead));
}

export function buildWhatsappLink(lead) {
  const phone = lead.whatsapp.replace(/\D/g, '');
  const message = `你好 ${lead.name}，我係 SilverCare，想跟進你的試用查詢。`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildLeadCsv(leads) {
  const columns = [
    'id',
    'name',
    'whatsapp',
    'preferredPlan',
    'status',
    'followUpNote',
    'painPoint',
    'source',
    'consentAcceptedAt',
    'createdAt',
  ];

  const rows = leads.map((lead) => columns
    .map((column) => escapeCsv(lead[column]))
    .join(','));

  return [columns.join(','), ...rows].join('\n');
}
