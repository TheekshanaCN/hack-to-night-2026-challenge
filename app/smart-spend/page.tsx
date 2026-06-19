'use client'

import Sidebar from '@/components/sidebar'

export default function SmartSpendPage() {
  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Smart Spend</h2>
          </div>
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>Analytics coming soon…</p>
          </div>
        </main>
      </div>
    </div>
  )
}
