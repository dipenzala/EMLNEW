import { describe, it, expect } from 'vitest';
import { parseCsv, mapAndValidate, csvEscape } from '../src/lib/csv';
describe('csv', () => {
  it('parses and validates', () => {
    const csv = 'Email,First Name,Company\nALICE@example.com,Alice,Acme\nbad, Bob, Beta\nalice@example.com,Alice,Dup\n';
    const { headers, rows } = parseCsv(csv); expect(headers).toContain('Email');
    const mapped = mapAndValidate(rows, { email: 'Email', first_name: 'First Name', company_name: 'Company' });
    expect(mapped[0].errors).toEqual([]); expect(mapped[0].email).toBe('alice@example.com');
    expect(mapped[1].errors).toContain('invalid email'); expect(mapped[2].errors).toContain('duplicate in file');
  });
  it('escapes csv formula injection', () => { expect(csvEscape('=SUM(1)')).toMatch(/^"'=SUM\(1\)"$/); expect(csvEscape('normal')).toBe('"normal"'); });
});
