'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', html: '', text_body: '' });
  const { push } = useToast();

  async function load() {
    const r = await fetch('/api/templates');
    if (r.ok) setTemplates(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) { push('Name is required'); return; }
    const method = selected?.id ? 'PUT' : 'POST'; // Using POST for create here for simplicity
    const url = selected?.id ? `/api/templates/${selected.id}` : '/api/templates';
    
    // In our API, we only implemented POST for create. Let's just create new for now.
    const r = await fetch('/api/templates', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form)
    });
    
    if (r.ok) { push('Template Saved ✅'); setIsEditing(false); load(); }
    else push('Save failed');
  }

  async function del(id: string) {
    if (!confirm('Delete this template?')) return;
    const r = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (r.ok) { push('Deleted'); load(); setSelected(null); }
  }

  return (
    <div>
      <div className="topbar">
        <h1>Email Templates</h1>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setForm({ name: '', subject: '', html: '', text_body: '' }); setIsEditing(true); }}>+ New Template</button>
      </div>

      <div className="grid-2">
        {/* List */}
        <div className="card">
          <p className="card-title">Saved Templates</p>
          {templates.length === 0 ? <p>No templates yet.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {templates.map(t => (
                <li key={t.id} style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'block' }}>{t.name}</strong>
                    <span style={{ fontSize: 12, color: '#666' }}>{t.subject}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => { setSelected(t); setIsEditing(false); }}>Preview</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(t.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor / Preview */}
        <div className="card">
          {isEditing ? (
            <div>
              <p className="card-title">Edit Template</p>
              <div className="field"><label>Template Name</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="field"><label>Subject</label><input className="input" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>
              <div className="field"><label>HTML Body (use {'{{first_name}}'})</label><textarea className="textarea" rows={10} value={form.html} onChange={e => setForm({...form, html: e.target.value})} /></div>
              <button className="btn btn-primary" onClick={save}>Save Template</button>
              <button className="btn" onClick={() => setIsEditing(false)} style={{ marginLeft: 10 }}>Cancel</button>
            </div>
          ) : selected ? (
            <div>
              <p className="card-title">Preview: {selected.name}</p>
              <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8, background: '#fafafa', minHeight: 200 }}>
                <strong>Subject:</strong> {selected.subject}<br/><br/>
                <div dangerouslySetInnerHTML={{ __html: selected.html.replace(/\{\{first_name\|there\}\}/g, 'John').replace(/\{\{first_name\}\}/g, 'John') }} />
              </div>
            </div>
          ) : (
            <p style={{ color: '#666' }}>Select a template to preview or create a new one.</p>
          )}
        </div>
      </div>
    </div>
  );
}
