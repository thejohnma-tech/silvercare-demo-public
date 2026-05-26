export function buildDemoUrl(publicUrl) {
  const url = new URL(publicUrl);
  url.searchParams.set('demo', '1');
  return url.toString();
}

export function buildOutreachMessage({ publicUrl, variant = 'warm' }) {
  const demoUrl = buildDemoUrl(publicUrl);
  const openers = {
    warm: '你好，我正在測試一個香港家庭用的安心照顧助手。',
    caregiver: '你好，想分享一個幫照顧者記錄提醒和防騙問題的小工具。',
    referral: '你好，朋友介紹我可以同你分享一個長者照顧跟進工具。',
  };

  return [
    openers[variant] ?? openers.warm,
    '安心照顧助手可以記錄覆診、食藥、可疑短訊、家庭跟進事項，也有防騙 FAQ。',
    `這是試用 demo：${demoUrl}`,
    '如果每月 HK$99/月起，你會不會想試用？有任何照顧痛點也可以直接回覆我。',
  ].join('\n\n');
}

export function buildWhatsappShareLink({ phone, message }) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildOutreachRows({ publicUrl, contacts }) {
  return contacts.slice(0, 15).map((contact, index) => {
    const message = contact.message ?? buildOutreachMessage({
      publicUrl,
      variant: contact.segment?.includes('care') ? 'caregiver' : 'warm',
    });

    return {
      ...contact,
      number: contact.number ?? index + 1,
      message,
      whatsappLink: contact.phone ? buildWhatsappShareLink({
        phone: contact.phone,
        message,
      }) : '',
    };
  });
}

export function addOutreachContact(contacts, { name, phone, segment, publicUrl }) {
  const contact = {
    id: `OUT-${Date.now().toString(36).toUpperCase()}`,
    number: contacts.length + 1,
    name: name.trim(),
    phone: phone.trim(),
    segment: segment.trim(),
    status: 'Queued',
    createdAt: new Date().toISOString(),
    sentAt: '',
  };

  return [
    ...contacts,
    buildOutreachRows({ publicUrl, contacts: [contact] })[0],
  ].slice(0, 15);
}

export function markOutreachSent(contacts, contactId) {
  return contacts.map((contact) => (contact.id === contactId ? {
    ...contact,
    status: 'Sent',
    sentAt: new Date().toISOString(),
  } : contact));
}
