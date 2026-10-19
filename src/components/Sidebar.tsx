'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items: Array<[string, string]> = [
  ['Overview', '/dashboard'],
  ['Quick Send', '/quick-send'],
  ['Senders', '/senders'],
  ['Contacts', '/contacts'],
  ['Campaigns', '/campaigns'],
  ['Analytics', '/analytics'],
  ['Suppression', '/suppression'],
  ['Activity', '/activity'],
  ['Settings', '/settings'],
  ['Help', '/help'],
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">CertWinX</div>
      <nav className="nav">
        {items.map(([label, href]) => (
          <Link key={href} href={href} className={path?.startsWith(href) ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
    </aside>
  );
}
