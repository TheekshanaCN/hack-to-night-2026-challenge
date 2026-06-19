'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid, CreditCard, ArrowLeftRight, Receipt,
  PieChart, FileText, Settings, HelpCircle, LogOut
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const menuItems = [
    { label: 'Dashboard',      path: '/dashboard',     icon: LayoutGrid },
    { label: 'Accounts',       path: '/bank-accounts', icon: CreditCard },
    { label: 'Bank Transfer',  path: '/bank-transfer', icon: ArrowLeftRight },
    { label: 'Pay Bills',      path: '/pay-bills',     icon: Receipt },
    { label: 'Smart Spend',    path: '/smart-spend',   icon: PieChart },
    { label: 'E-Statement',    path: '/e-statement',   icon: FileText },
  ]

  return (
    <aside className="nova-sidebar">
      {/* Logo */}
      <div style={{ padding: '1.75rem 1.25rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            boxShadow: '0 0 16px rgba(124,58,237,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: '#fff',
          }}>N</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>NOVA BANK</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', fontWeight: 600 }}>BANKING</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {menuItems.map(({ label, path, icon: Icon }) => (
          <Link key={path} href={path} className={`nova-nav-item${pathname === path ? ' active' : ''}`}>
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div style={{ margin: '0 1rem', height: 1, background: 'var(--border)' }} />

      {/* Footer */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href="/profile" title="Profile & Settings" style={{
          width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s',
        }}>
          <Settings size={16} />
        </Link>
        <button title="Help" style={{
          width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <HelpCircle size={16} />
        </button>
        <button onClick={handleLogout} title="Logout" style={{
          width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--error)', cursor: 'pointer', marginLeft: 'auto',
        }}>
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
