export const servicePackages = [
  {
    id: 'self-serve',
    name: '自助安心版',
    price: 99,
    currency: 'HKD',
    cadence: '每月',
    summary: '適合先試用的家庭：提醒、工單記錄、防騙 FAQ 和每月安心摘要。',
    checklist: [
      '建立家庭跟進事項',
      '提醒家人不要提供 OTP、密碼或銀行資料',
      '加入每週防騙及覆診提醒',
    ],
  },
  {
    id: 'family-care',
    name: '家庭安心版',
    price: 199,
    currency: 'HKD',
    cadence: '每月',
    summary: '適合多位家人共同跟進：更多提醒、優先模板和月度安心報告。',
    checklist: [
      '建立家庭跟進事項',
      '提醒家人不要提供 OTP、密碼或銀行資料',
      '整理多位家人的待辦分工',
      '生成月度安心報告',
    ],
  },
  {
    id: 'care-plus',
    name: '安心進階版',
    price: 399,
    currency: 'HKD',
    cadence: '每月',
    summary: '適合需要更密跟進的家庭：高風險事項標示、報告摘要和升級支援流程。',
    checklist: [
      '建立家庭跟進事項',
      '提醒家人不要提供 OTP、密碼或銀行資料',
      '標示高風險防騙或緊急跟進',
      '提供下一步處理清單',
    ],
  },
];

export function getPackageById(id) {
  const found = servicePackages.find((plan) => plan.id === id);
  if (!found) {
    throw new Error(`Unknown package: ${id}`);
  }
  return found;
}

function isHighRiskConcern(concern) {
  return [
    'OTP',
    '驗證碼',
    '密碼',
    '銀行',
    '轉帳',
    '匯款',
    '可疑電話',
    '短訊',
    '連結',
  ].some((keyword) => concern.includes(keyword));
}

export function buildTicket({ customerName, packageId, concern }) {
  const plan = getPackageById(packageId);
  const trimmedConcern = concern.trim();

  return {
    id: `TKT-${Date.now().toString(36).toUpperCase()}`,
    customerName: customerName.trim(),
    packageId: plan.id,
    packageName: plan.name,
    price: plan.price,
    currency: plan.currency,
    concern: trimmedConcern,
    status: 'Paid',
    priority: isHighRiskConcern(trimmedConcern) ? 'High' : 'Normal',
    createdAt: new Date().toISOString(),
    checklist: [...plan.checklist],
  };
}

export function replyToQuestion(question) {
  const normalized = question.toLowerCase();

  if (
    question.includes('OTP')
    || question.includes('驗證碼')
    || question.includes('銀行')
    || question.includes('短訊')
    || question.includes('轉帳')
    || normalized.includes('sms')
  ) {
    return '不要提供 OTP、密碼、銀行資料或點擊可疑連結。請用官方電話或官方 App 核實；如懷疑受騙，香港可致電警方反詐騙熱線 18222 查詢。';
  }

  if (
    question.includes('血壓')
    || question.includes('藥')
    || question.includes('痛')
    || question.includes('病')
    || normalized.includes('medicine')
  ) {
    return '我不能提供醫療診斷或用藥建議。請記錄症狀、量度時間和讀數，並聯絡醫生、藥劑師或相關醫護人員跟進。';
  }

  if (
    question.includes('價錢')
    || question.includes('收費')
    || question.includes('月費')
    || normalized.includes('price')
  ) {
    return '自助安心版每月 HK$99，家庭安心版每月 HK$199，進階版每月 HK$399。MVP 會先用模擬付款流程展示完整體驗。';
  }

  return '我可以協助整理防騙、覆診、食藥提醒和家庭待辦。請描述要跟進的事項，但不要提供密碼、OTP、銀行資料或身份證號碼。';
}

export function getReminderStatus(dateValue, now = new Date()) {
  const dueAt = new Date(`${dateValue}T23:59:59+08:00`);
  return dueAt.getTime() < now.getTime() ? 'Due' : 'Scheduled';
}
