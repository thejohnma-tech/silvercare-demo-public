import { buildTicket } from './core.mjs';
import { buildPilotFromLead } from './pilots.mjs';

export function isPublicDemoRequest(search = '') {
  const params = new URLSearchParams(search);
  const value = params.get('demo');
  return value === '1' || value === 'true';
}

export function buildPublicDemoCredentials(config = {}) {
  const pin = config.demoPin || '2468';
  return {
    email: config.adminEmail || 'owner@silvercare.test',
    pin,
    password: pin,
  };
}

export function createPublicDemoState(baseState) {
  const demoTicket = buildTicket({
    customerName: 'Demo Family',
    packageId: 'family-care',
    concern: '媽媽收到可疑電話，對方要求提供 OTP。',
  });
  const demoPilot = buildPilotFromLead({
    lead: {
      id: 'DEMO',
      name: 'Demo Family',
      whatsapp: '+852 9123 4567',
      email: 'family@example.com',
      source: 'public-demo',
      painPoint: '7-day follow-up for HK$99 pilot',
      relationship: '摮戊',
    },
    startDate: '2026-05-20',
  });

  return {
    ...baseState,
    profile: {
      name: 'Demo Family',
      phone: '+852 9123 4567',
      email: 'family@example.com',
      relationship: '子女',
    },
    selectedPackageId: 'family-care',
    tickets: baseState.tickets.length ? baseState.tickets : [demoTicket],
    paidPilots: (baseState.paidPilots ?? []).length ? baseState.paidPilots : [demoPilot],
    reminders: baseState.reminders.length ? baseState.reminders : [
      {
        id: 'REM-DEMO',
        title: '提醒爸爸星期五覆診',
        date: '2026-06-05',
      },
    ],
  };
}
