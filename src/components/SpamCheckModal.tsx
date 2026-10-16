'use client';
import type { SpamReport } from '@/lib/spam';

export default function SpamCheckModal({
  open,
  report,
  busy,
  onCancel,
  onConfirm,
  actionLabel = 'Send anyway',
}: {
  open: boolean;
  report: SpamReport | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  actionLabel?: string;
}) {
  if (!open || !report) return null;

  const color = report.level === 'good' ? '#16A34A' : report.level === 'warn' ? '#D97706' : '#DC2626';
  const bg = report.level === 'good' ? '#DCFCE7' : report.level === 'warn' ? '#FEF3C7' : '#FEE2E2';
  const label =
    report.level === 'good' ? 'Looks good — low spam risk' :
    report.level === 'warn' ? 'Some spam signals detected' :
    'High spam risk — likely to land in spam';

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: bg }}>
          <div>
            <div className="modal-title">Spam quality check</div>
            <div className="modal-sub" style={{ color }}>{label}</div>
          </div>
          <div className="modal-score" style={{ color }}>
            {report.score.toFixed(1)}
            <span className="modal-score-max">/10</span>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-stats">
            <div><span>Subject</span><strong>{report.stats.subjectLength} chars</strong></div>
            <div><span>Body</span><strong>{report.stats.bodyLength} chars</strong></div>
            <div><span>Links</span><strong>{report.stats.linkCount}</strong></div>
            <div><span>Images</span><strong>{report.stats.imageCount}</strong></div>
          </div>

          {report.issues.length === 0 ? (
            <div className="modal-ok">
              ✅ No issues found. Safe to send.
            </div>
          ) : (
            <ul className="modal-issues">
              {report.issues.map((i, idx) => (
                <li key={idx} className={i.severity === 'error' ? 'err' : 'warn'}>
                  <span className="dot" style={{ background: i.severity === 'error' ? '#DC2626' : '#D97706' }} />
                  {i.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Sending…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
