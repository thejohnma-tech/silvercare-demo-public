export function buildDemoUrl(publicUrl) {
  const url = new URL(publicUrl);
  url.searchParams.set('demo', '1');
  return url.toString();
}

export function buildOutreachMessage({ publicUrl, variant = 'warm' }) {
  const demoUrl = buildDemoUrl(publicUrl);

  if (variant === 'referral') {
    return [
      'Hi，我係 John。朋友話你可能有幫屋企長輩跟進日常事項。',
      '我做緊一個「長者安心跟進」demo，幫家人追蹤防騙提醒、覆診、食藥同家庭待辦。',
      `可以直接試，不用登入：${demoUrl}`,
      '服務唔涉及醫療診斷、緊急救援、銀行資料、密碼或 OTP。',
      '你試完可唔可以話我知：HK$99/月，你會唔會試？',
    ].join('\n\n');
  }

  if (variant === 'caregiver') {
    return [
      'Hi，我最近做緊一個照顧長者家庭用的 demo。',
      '它主要幫家人記錄和提醒防騙、覆診、食藥同家庭待辦，適合不想日日靠記憶或 WhatsApp 搵紀錄的家庭。',
      `可以直接試，不用登入：${demoUrl}`,
      '如果 HK$99/月，你覺得有冇機會試一個月？',
    ].join('\n\n');
  }

  return [
    'Hi，我最近做緊一個「安心照顧助手」demo，幫香港家庭記錄同提醒父母嘅防騙、覆診、食藥同家庭待辦。',
    `你可以直接試，不用登入：${demoUrl}`,
    '我唔係想硬 sell，係想搵 10 個有照顧父母經驗嘅人俾真 feedback。',
    '你試完可唔可以直接答我：如果 HK$99/月，你會唔會試？',
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
