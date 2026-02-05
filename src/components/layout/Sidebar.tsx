'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/drivers', label: 'Drivers', icon: '👥' },
  { href: '/reactivation', label: 'Reaktivatsiya', icon: '🔄' },
  { href: '/budget', label: 'Budjet', icon: '💰' },
  { href: '/campaigns', label: 'Campaigns', icon: '📢' },
  { href: '/sms', label: 'SMS Matching', icon: '📱' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-900 min-h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Driver Admin</h1>
        <p className="text-xs text-gray-400 mt-1">Toshkent Viloyati Launch</p>
      </div>

      {/* Menu */}
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Campaign Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400">
          <div>Campaign: 29.01 - 27.02.2026</div>
          <div>Target: 300 Active Drivers</div>
        </div>
      </div>
    </div>
  );
}
