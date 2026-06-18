import Link from 'next/link'
import AuthButton from '@/components/authButton'

export default function LoginPage() {
  return (
    <section className="mx-auto flex min-h-[480px] w-full max-w-[1060px] overflow-hidden rounded-[56px] bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:min-h-[660px]">
      <aside
        aria-label="Nova Bank shell artwork"
        className="relative hidden w-[46.2%] shrink-0 overflow-hidden bg-[#1d0730] md:block"
      >
        <img
          src="/loginshellbg.png"
          alt=""
          className="size-full object-cover"
          aria-hidden="true"
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/loginlogo.png"
            alt="Nova Bank"
            className="w-[38%] max-w-[276px]"
          />
        </div>
      </aside>

      <div className="flex flex-1 items-center justify-center bg-white px-8 py-10">
        <div className="w-full max-w-[450px] text-center">
          <h1 className="mb-11 text-[2.45rem] font-bold text-black text-balance">
            LOGIN
          </h1>

          <div className="space-y-5">
            <div className="relative">
              <label className="sr-only" htmlFor="login-account">
                Account name
              </label>
              <img
                src="/person.png"
                alt=""
                aria-hidden="true"
                className="-translate-y-1/2 absolute left-8 top-1/2 size-6"
              />
              <input
                id="login-account"
                placeholder="Account name"
                className="h-[64px] w-full rounded-[40px] border-0 bg-[#d9d9d9] px-8 pl-20 text-lg text-black shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] outline-none transition-shadow placeholder:text-black/45 focus:shadow-[0_4px_4px_0_rgba(0,0,0,0.30),0_8px_12px_6px_rgba(0,0,0,0.15)]"
              />
            </div>

            <div className="relative">
              <label className="sr-only" htmlFor="login-password">
                Password
              </label>
              <img
                src="/password.png"
                alt=""
                aria-hidden="true"
                className="-translate-y-1/2 absolute left-8 top-1/2 size-6"
              />
              <input
                id="login-password"
                type="password"
                placeholder="Password"
                className="h-[64px] w-full rounded-[40px] border-0 bg-[#d9d9d9] px-8 pl-20 text-lg text-black shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] outline-none transition-shadow placeholder:text-black/45 focus:shadow-[0_4px_4px_0_rgba(0,0,0,0.30),0_8px_12px_6px_rgba(0,0,0,0.15)]"
              />
            </div>
          </div>

          <div className="mt-3 text-right">
            <Link
              href="/accounts/reset-password"
              className="text-sm font-bold text-black"
            >
              Forgot password?
            </Link>
          </div>

          <AuthButton className="mt-8">SIGN IN</AuthButton>

          <p className="mt-6 text-sm font-bold text-black">
            Don`t have an account?
          </p>
          <Link
            href="/accounts/sign-up"
            className="text-2xl font-bold text-black"
          >
            SIGN UP
          </Link>
        </div>
      </div>
    </section>
  )
}
