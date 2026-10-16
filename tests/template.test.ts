import { describe, it, expect } from 'vitest';
import { renderTemplate, sanitizeUserHtml, toPlainText } from '../src/lib/template';
describe('template', () => {
  it('renders tokens with fallback', () => { expect(renderTemplate('Hi {{first_name|there}}!', {}, { html: false })).toBe('Hi there!'); expect(renderTemplate('Hi {{first_name|there}}!', { first_name: 'Sam' }, { html: false })).toBe('Hi Sam!'); });
  it('escapes HTML in values when html=true', () => { expect(renderTemplate('<p>{{first_name}}</p>', { first_name: '<script>' })).toContain('&lt;script&gt;'); });
  it('sanitizes dangerous HTML', () => { const out = sanitizeUserHtml('<img src=x onerror=alert(1)><script>alert(2)</script><p onclick=x>ok</p>'); expect(out).not.toContain('<script'); expect(out).not.toContain('onerror'); expect(out).not.toContain('onclick'); });
  it('converts html to text', () => { expect(toPlainText('<p>Hello<br>World</p>')).toBe('Hello\nWorld'); });
});
