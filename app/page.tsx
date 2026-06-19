import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Smart Spend</h1>
        <p className="text-xl text-gray-600 mb-8">
          Manage your finances effortlessly
        </p>

        <nav className="flex flex-wrap justify-center gap-4">
          <Link
            href="/bank-accounts"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Accounts
          </Link>
          <Link
            href="/bank-transfer"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Bank Transfer
          </Link>
          <Link
            href="/pay-bills"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Pay Bills
          </Link>
          <Link
            href="/e-statement"
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            E-Statement
          </Link>
          <Link
            href="/smart-spend"
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Smart Spend
          </Link>
        </nav>
      </div>
    </main>
  )
}
