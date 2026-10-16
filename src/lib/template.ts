import sanitizeHtml from 'sanitize-html';
export type Tokens = Record<string, string | undefined>;
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function renderTemplate(tpl: string, tokens: Tokens, { html = true } = {}): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*))?\}\}/g, (_, key: string, fallback?: string) => {
    const raw = tokens[key];
    const value = (raw ?? fallback ?? '').toString();
    return html ? escapeHtml(value) : value;
  });
}
export function sanitizeUserHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['a','b','i','u','em','strong','p','br','ul','ol','li','h1','h2','h3','h4','blockquote','code','pre','hr','img','table','thead','tbody','tr','td','th','div','span'],
    allowedAttributes: { a: ['href','title','target','rel'], img: ['src','alt','width','height'], '*': ['style'] },
    allowedSchemes: ['http','https','mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) }
  });
}
export function toPlainText(html: string): string {
  return html.replace(/<\s*br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
