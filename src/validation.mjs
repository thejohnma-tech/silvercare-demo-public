function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function countBy(rows, predicate) {
  return rows.filter(predicate).length;
}

export function analyzeValidationReplies(rows) {
  const replyCount = countBy(rows, (row) => normalized(row.reply) === 'yes');
  const wouldPayCount = countBy(rows, (row) => normalized(row.wouldPayHkd99) === 'yes');
  const startRequestCount = countBy(rows, (row) => normalized(row.asksToStart) === 'yes');
  const objections = rows
    .map((row) => normalized(row.objection))
    .filter(Boolean);

  let recommendation = 'keep-interviewing';
  if (wouldPayCount >= 3 || startRequestCount >= 1) {
    recommendation = 'paid-pilot';
  } else if (replyCount > 0) {
    recommendation = 'narrow-positioning';
  }

  return {
    recommendation,
    replyCount,
    wouldPayCount,
    startRequestCount,
    topObjections: [...new Set(objections)],
  };
}

export function buildValidationReport(rows) {
  const result = analyzeValidationReplies(rows);
  return [
    '# SilverCare Validation Report',
    '',
    `Recommendation: ${result.recommendation}`,
    `Replies: ${result.replyCount}`,
    `Would pay HK$99: ${result.wouldPayCount}`,
    `Asked to start: ${result.startRequestCount}`,
    `Top objections: ${result.topObjections.length ? result.topObjections.join(', ') : 'none recorded'}`,
    '',
    result.recommendation === 'paid-pilot'
      ? 'Next step: offer a 4-week HK$99 paid pilot to the strongest leads.'
      : 'Next step: interview replies and narrow the offer before building more features.',
  ].join('\n');
}
