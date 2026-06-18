export default function AccountsLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <main
      className="relative flex min-h-dvh items-center justify-center overflow-auto bg-cover bg-center px-4 py-8 font-geist sm:px-8"
      style={{ backgroundImage: "url('/loginmainbg.png')" }}
    >
      <div className="w-full max-w-[1176px]">{children}</div>
    </main>
  )
}
