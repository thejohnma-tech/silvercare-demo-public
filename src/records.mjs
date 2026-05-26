import { getDefaultState } from './storage.mjs';

export function normalizeStateToRecords(state, workspaceId) {
  const customer = state.profile ? {
    workspace_id: workspaceId,
    name: state.profile.name,
    phone: state.profile.phone,
    email: state.profile.email,
    relationship: state.profile.relationship,
  } : null;

  const customerEmail = customer?.email ?? null;

  return {
    customer,
    tickets: state.tickets.map((ticket) => ({
      workspace_id: workspaceId,
      customer_email: customerEmail,
      id: ticket.id,
      package_id: ticket.packageId,
      package_name: ticket.packageName,
      price: ticket.price,
      currency: ticket.currency,
      concern: ticket.concern,
      status: ticket.status,
      priority: ticket.priority,
      checklist: ticket.checklist,
      created_at: ticket.createdAt,
    })),
    reminders: state.reminders.map((reminder) => ({
      workspace_id: workspaceId,
      id: reminder.id,
      title: reminder.title,
      due_date: reminder.date,
    })),
    orders: (state.orders ?? []).map((order) => ({
      workspace_id: workspaceId,
      id: order.id,
      customer_email: order.customerEmail,
      package_id: order.packageId,
      package_name: order.packageName,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      provider: order.provider,
      checkout_url: order.checkoutUrl,
      created_at: order.createdAt,
      paid_at: order.paidAt,
    })),
    leads: (state.leads ?? []).map((lead) => ({
      workspace_id: workspaceId,
      id: lead.id,
      name: lead.name,
      whatsapp: lead.whatsapp,
      pain_point: lead.painPoint,
      preferred_plan: lead.preferredPlan,
      status: lead.status,
      follow_up_note: lead.followUpNote ?? '',
      source: lead.source,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt ?? lead.createdAt,
    })),
    outreach_contacts: (state.outreachContacts ?? []).map((contact) => ({
      workspace_id: workspaceId,
      id: contact.id,
      number: contact.number,
      name: contact.name,
      phone: contact.phone,
      segment: contact.segment,
      status: contact.status,
      message: contact.message,
      whatsapp_link: contact.whatsappLink,
      created_at: contact.createdAt,
      sent_at: contact.sentAt || null,
    })),
    messages: state.chat.map((message, index) => ({
      workspace_id: workspaceId,
      id: `${workspaceId}-MSG-${index}`,
      role: message.role,
      text: message.text,
      created_at: message.createdAt ?? new Date(0).toISOString(),
    })),
  };
}

export function hydrateStateFromRecords(records) {
  const state = getDefaultState();
  state.profile = records.customer ? {
    name: records.customer.name,
    phone: records.customer.phone,
    email: records.customer.email,
    relationship: records.customer.relationship,
  } : null;

  state.tickets = (records.tickets ?? []).map((ticket) => ({
    id: ticket.id,
    packageId: ticket.package_id,
    packageName: ticket.package_name,
    price: ticket.price,
    currency: ticket.currency,
    concern: ticket.concern,
    status: ticket.status,
    priority: ticket.priority,
    checklist: ticket.checklist ?? [],
    createdAt: ticket.created_at,
  }));

  state.reminders = (records.reminders ?? []).map((reminder) => ({
    id: reminder.id,
    title: reminder.title,
    date: reminder.due_date,
  }));

  state.orders = (records.orders ?? []).map((order) => ({
    id: order.id,
    customerEmail: order.customer_email,
    packageId: order.package_id,
    packageName: order.package_name,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    provider: order.provider,
    checkoutUrl: order.checkout_url,
    createdAt: order.created_at,
    paidAt: order.paid_at,
  }));

  state.leads = (records.leads ?? []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    whatsapp: lead.whatsapp,
    painPoint: lead.pain_point,
    preferredPlan: lead.preferred_plan,
    status: lead.status,
    followUpNote: lead.follow_up_note ?? '',
    source: lead.source,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at ?? lead.created_at,
  }));

  state.outreachContacts = (records.outreach_contacts ?? []).map((contact) => ({
    id: contact.id,
    number: contact.number,
    name: contact.name,
    phone: contact.phone,
    segment: contact.segment,
    status: contact.status,
    message: contact.message,
    whatsappLink: contact.whatsapp_link,
    createdAt: contact.created_at,
    sentAt: contact.sent_at ?? '',
  }));

  state.chat = (records.messages ?? []).map((message) => ({
    role: message.role,
    text: message.text,
    createdAt: message.created_at,
  }));

  return state;
}

async function expectNoError(result) {
  if (result?.error) {
    throw new Error(result.error.message);
  }
  return result;
}

export function createSupabaseRecordStore(client, workspaceId = 'silvercare-demo') {
  return {
    mode: 'supabase-records',
    async load() {
      const [customers, tickets, reminders, orders, leads, outreachContacts, messages] = await Promise.all([
        client.from('customers').select('*').eq('workspace_id', workspaceId),
        client.from('tickets').select('*').eq('workspace_id', workspaceId),
        client.from('reminders').select('*').eq('workspace_id', workspaceId),
        client.from('orders').select('*').eq('workspace_id', workspaceId),
        client.from('leads').select('*').eq('workspace_id', workspaceId),
        client.from('outreach_contacts').select('*').eq('workspace_id', workspaceId),
        client.from('messages').select('*').eq('workspace_id', workspaceId),
      ]);

      [customers, tickets, reminders, orders, leads, outreachContacts, messages].forEach((result) => {
        if (result.error) {
          throw new Error(result.error.message);
        }
      });

      return hydrateStateFromRecords({
        customer: customers.data?.[0] ?? null,
        tickets: tickets.data ?? [],
        reminders: reminders.data ?? [],
        orders: orders.data ?? [],
        leads: leads.data ?? [],
        outreach_contacts: outreachContacts.data ?? [],
        messages: messages.data ?? [],
      });
    },
    async save(state) {
      const records = normalizeStateToRecords(state, workspaceId);
      await Promise.all([
        expectNoError(await client.from('tickets').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('reminders').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('orders').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('leads').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('outreach_contacts').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('messages').delete().eq('workspace_id', workspaceId)),
      ]);

      if (records.customer) {
        await expectNoError(await client.from('customers').upsert(records.customer).select().single());
      }
      if (records.tickets.length) {
        await expectNoError(await client.from('tickets').upsert(records.tickets).select().single());
      }
      if (records.reminders.length) {
        await expectNoError(await client.from('reminders').upsert(records.reminders).select().single());
      }
      if (records.orders.length) {
        await expectNoError(await client.from('orders').upsert(records.orders).select().single());
      }
      if (records.leads.length) {
        await expectNoError(await client.from('leads').upsert(records.leads).select().single());
      }
      if (records.outreach_contacts.length) {
        await expectNoError(await client.from('outreach_contacts').upsert(records.outreach_contacts).select().single());
      }
      if (records.messages.length) {
        await expectNoError(await client.from('messages').upsert(records.messages).select().single());
      }
    },
    async reset() {
      await Promise.all([
        expectNoError(await client.from('tickets').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('reminders').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('orders').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('leads').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('outreach_contacts').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('messages').delete().eq('workspace_id', workspaceId)),
        expectNoError(await client.from('customers').delete().eq('workspace_id', workspaceId)),
      ]);
    },
  };
}
