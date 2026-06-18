'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Minimal icon components to avoid external dependency
type IconProps = { size?: number }
const LayoutGrid = ({ size = 18 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="8"
      height="8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="13"
      y="3"
      width="8"
      height="8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="3"
      y="13"
      width="8"
      height="8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="13"
      y="13"
      width="8"
      height="8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
)

const Settings = ({ size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 2.28 16.9l.06-.06c.45-.45.58-1.1.33-1.82a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.7 0 1.27-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82L4.3 4.3A2 2 0 1 1 7.12 1.47l.06.06c.45.45 1.1.58 1.82.33.6-.25 1.26-.25 1.86 0 .72.25 1.37.12 1.82-.33l.06-.06A2 2 0 1 1 19.7 4.3l-.06.06c-.45.45-.58 1.1-.33 1.82.25.6.25 1.26 0 1.86a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83l-.06.06z"
      stroke="currentColor"
      strokeWidth="1"
    />
  </svg>
)

const HelpCircle = ({ size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M12 17h.01"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M9.5 10a2.5 2.5 0 1 1 5 0c0 1.75-2 2.25-2 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

export default function Sidebar() {
  const pathname = usePathname()

  const menuItems = [
    { label: 'DASHBOARD', path: '/dashboard' },
    { label: 'ACCOUNTS', path: '/bank-accounts' },
    { label: 'BANK TRANSFER', path: '/bank-transfer' },
    { label: 'PAY BILLS', path: '/pay-bills' },
    { label: 'SMART SPEND', path: '/smart-spend' },
    { label: 'E-STATEMENT', path: '/e-statement' }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        {/* Logo */}
        <div className="logo-wrapper">
          <img src="/loginlogo.png" alt="logo" className="logo-img" />
          <h1 className="brand-name">NOVA BANK</h1>
        </div>

        {/* Menu */}
        <nav className="menu">
          {menuItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link key={item.label} href={item.path} className="menu-link">
                <button className={`menu-item ${isActive ? 'active' : ''}`}>
                  {item.label === 'DASHBOARD' && <LayoutGrid size={18} />}
                  {item.label}
                </button>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <Settings size={24} />
        <HelpCircle size={24} />
      </div>

      <style jsx>{`
        .sidebar {
          width: 250px;
          background: #450043;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: 0 25px 25px 0;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
        }

        .sidebar-top {
          display: flex;
          flex-direction: column;
        }

        .logo-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 0.75rem;
        }

        .logo-img {
          width: 75px;
          height: 75px;
          border-radius: 50%;
          background: white;
          object-fit: cover;
        }

        .brand-name {
          color: white;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .menu {
          margin-top: 3rem;
          padding: 0 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .menu-link {
          text-decoration: none;
        }

        .menu-item {
          height: 50px;
          border: none;
          background: transparent;
          color: white;
          text-align: left;
          padding: 0 1.5rem;
          border-radius: 25px;
          transition: all 0.3s;
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          width: 100%;
        }

        .menu-item.active {
          background: #9a5c97;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .menu-item:hover {
          background: #9a5c97;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .sidebar-footer {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          color: white;
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            border-radius: 0 0 25px 25px;
            flex-direction: row;
            flex-wrap: wrap;
            padding: 0.75rem 1rem;
            align-items: center;
          }

          .sidebar-top {
            flex-direction: row;
            align-items: center;
            gap: 1rem;
            flex: 1;
          }

          .logo-wrapper {
            padding: 0;
          }
          .logo-img {
            width: 50px;
            height: 50px;
          }
          .brand-name {
            font-size: 16px;
          }

          .menu {
            flex-direction: row;
            flex-wrap: wrap;
            margin-top: 0;
            padding: 0;
            gap: 0.5rem;
          }
          .menu-item {
            padding: 0 1rem;
            height: 40px;
            font-size: 0.75rem;
            white-space: nowrap;
            width: auto;
          }

          .sidebar-footer {
            padding: 0;
            gap: 1rem;
          }
        }

        @media (max-width: 480px) {
          .menu-item {
            font-size: 0.7rem;
            padding: 0 0.75rem;
            height: 34px;
          }
          .brand-name {
            font-size: 14px;
          }
          .logo-img {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </aside>
  )
}
