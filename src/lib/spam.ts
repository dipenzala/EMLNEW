export type SpamIssue = { severity: 'warn' | 'error'; text: string };

export type SpamReport = {
  score: number;                 // 0 (clean) .. 10 (very spammy)
  level: 'good' | 'warn' | 'bad'; // good <3, warn <6, bad >=6
  issues: SpamIssue[];
  stats: {
    subjectLength: number;
    bodyLength: number;
    linkCount: number;
    imageCount: number;
    triggers: string[];
  };
};

const TRIGGER_WORDS = [
  'free', 'guaranteed', 'winner', 'win money', 'cash', 'prize', 'urgent',
  'act now', 'click here', 'click below', 'limited time', 'no obligation',
  'risk free', 'risk-free', 'buy now', 'order now', 'subscribe now',
  'earn money', 'make money', 'work from home', 'extra income',
  'get paid', 'double your', 'million dollars', 'credit card',
  'viagra', 'cialis', 'pharmacy', 'porn', 'sex',
  'lowest price', 'cheapest', 'best price', 'save up to',
  'incredible deal', 'once in a lifetime', 'why pay more',
  'satisfaction guaranteed', 'no credit check',
  'weight loss', 'get out of debt',
  'this is not spam', 'not a scam', '100% free', 'no cost',
];

const ALL_CAPS = /\b[A-Z]{5,}\b/g;
const EXCESSIVE_PUNCT = /[!?]{3,}/g;
const MULTI_DOLLAR = /\$\$\$+/;

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&nbsp;/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

export function checkSpam(opts: {
  subject: string;
  html: string;
  text?: string;
  hasUnsubscribe?: boolean;
}): SpamReport {
  const subject = (opts.subject || '').trim();
  const html = opts.html || '';
  const bodyText = (opts.text?.trim() || stripHtml(html)).toLowerCase();
  const issues: SpamIssue[] = [];
  let score = 0;

  // Trigger words
  const triggers: string[] = [];
  for (const w of TRIGGER_WORDS) {
    const lc = w.toLowerCase();
    const inSubject = subject.toLowerCase().includes(lc);
    const inBody = bodyText.includes(lc);
    if (inSubject || inBody) {
      if (!triggers.includes(w)) triggers.push(w);
      if (inSubject) score += 1.5;
      else score += 0.5;
    }
  }
  if (triggers.length > 0) {
    issues.push({
      severity: triggers.length >= 3 ? 'error' : 'warn',
      text: `Spam trigger words detected: ${triggers.slice(0, 8).join(', ')}${triggers.length > 8 ? '…' : ''}`,
    });
  }

  // ALL CAPS in subject
  const capsInSubject = countMatches(subject, ALL_CAPS);
  if (capsInSubject > 0) {
    score += 1;
    issues.push({ severity: 'warn', text: `ALL-CAPS word(s) in subject (${capsInSubject})` });
  }

  // Excessive punctuation
  const punctSubject = countMatches(subject, EXCESSIVE_PUNCT);
  const punctBody = countMatches(html, EXCESSIVE_PUNCT);
  if (punctSubject + punctBody > 0) {
    score += 1;
    issues.push({ severity: 'warn', text: 'Excessive punctuation (!!! or ???)' });
  }

  // $$$ in subject/body
  if (MULTI_DOLLAR.test(subject) || MULTI_DOLLAR.test(html)) {
    score += 1.5;
    issues.push({ severity: 'error', text: 'Multiple $$$ symbols detected' });
  }

  // Subject length
  if (subject.length === 0) {
    score += 5;
    issues.push({ severity: 'error', text: 'Subject is empty' });
  } else if (subject.length < 15) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'Subject is very short (< 15 chars)' });
  } else if (subject.length > 90) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'Subject is long (> 90 chars) — may get cut off' });
  }

  // Body length
  const plainLen = bodyText.length;
  if (plainLen < 40) {
    score += 2;
    issues.push({ severity: 'error', text: 'Email body is very short — looks like a test or spam' });
  } else if (plainLen < 120) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'Email body is short (< 120 chars)' });
  }

  // Links
  const linkCount = (html.match(/<a\b/gi) || []).length;
  if (linkCount > 15) {
    score += 1.5;
    issues.push({ severity: 'error', text: `Too many links (${linkCount}) — flagged by most providers` });
  } else if (linkCount > 8) {
    score += 0.5;
    issues.push({ severity: 'warn', text: `Many links (${linkCount})` });
  }

  // Images
  const imageCount = (html.match(/<img\b/gi) || []).length;
  if (imageCount > 0 && plainLen < 80) {
    score += 2;
    issues.push({ severity: 'error', text: 'Image-only email with little text — high spam risk' });
  }

  // Plain text fallback
  const hasPlain = !!(opts.text && opts.text.trim().length > 0);
  if (!hasPlain) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'No plain-text fallback provided' });
  }

  // Unsubscribe
  if (opts.hasUnsubscribe === false) {
    score += 1;
    issues.push({ severity: 'warn', text: 'No unsubscribe link — marketing emails should include one' });
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const level: SpamReport['level'] = score < 3 ? 'good' : score < 6 ? 'warn' : 'bad';

  return {
    score,
    level,
    issues,
    stats: {
      subjectLength: subject.length,
      bodyLength: plainLen,
      linkCount,
      imageCount,
      triggers,
    },
  };
}
