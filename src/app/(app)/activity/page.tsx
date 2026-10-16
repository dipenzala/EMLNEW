'use client';
import { useEffect, useState } from 'react';
type Row = { id: number; action: string; detail: Record<string, unknown>; created_at: string };
export default function ActivityPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { fetch('/api/activity', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows); }, []);
  if (!rows) return <div className="skeleton" style={{ height: 60 }} />;
  return (
    <>
      <div className="topbar"><h1>Activity log</h1></div>
      {rows.length === 0 ? <div className="empty">No activity yet.</div> :
       <div className="card" style={{ padding: 0 }}>
         <table className="table">
           <thead><tr><th>Time</th><th>Action</th><th>Detail</th></tr></thead>
           <tbody>
             {rows.map((r) => (
               <tr key={r.id}>
                 <td>{new Date(r.created_at).toLocaleString()}</td>
                 <td><span className="badge badge-info">{r.action}</span></td>
                 <td style={{ fontSize: 12, color: '#475569', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JSON.stringify(r.detail)}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
      }
    </>
  );
}
