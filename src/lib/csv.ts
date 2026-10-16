import Papa from 'papaparse';
import { emailSchema } from './validation';
export type CsvRow = Record<string, string>;
export type Mapping = { email: string; first_name?: string; last_name?: string; company_name?: string; tags?: string };
export type ParsedContact = { email: string; first_name?: string; last_name?: string; company_name?: string; tags: string[]; rowIndex: number; errors: string[]; };
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[]; errors: string[] } {
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data, errors: parsed.errors.map((e) => e.message) };
}
export function mapAndValidate(rows: CsvRow[], mapping: Mapping): ParsedContact[] {
  const seen = new Set<string>(); const out: ParsedContact[] = [];
  rows.forEach((r, i) => {
    const errors: string[] = []; const rawEmail = (r[mapping.email] ?? '').trim().toLowerCase(); const parsed = emailSchema.safeParse(rawEmail);
    if (!rawEmail) errors.push('missing email'); else if (!parsed.success) errors.push('invalid email'); else if (seen.has(rawEmail)) errors.push('duplicate in file');
    const tagsRaw = mapping.tags ? (r[mapping.tags] ?? '') : ''; const tags = tagsRaw.split(/[;,]/).map((t) => t.trim()).filter(Boolean).slice(0, 50);
    if (!errors.length) seen.add(rawEmail);
    out.push({ email: rawEmail, first_name: mapping.first_name ? r[mapping.first_name] : undefined, last_name: mapping.last_name ? r[mapping.last_name] : undefined, company_name: mapping.company_name ? r[mapping.company_name] : undefined, tags, rowIndex: i, errors });
  });
  return out;
}
export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v); const dangerous = /^[=+\-@\t\r]/.test(s) ? "'" : '';
  return `"${(dangerous + s).replace(/"/g, '""')}"`;
}
