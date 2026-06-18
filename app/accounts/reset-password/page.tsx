import AuthButton from '@/components/authButton'

export default function ResetPasswordPage() {
  return (
    <section className="mx-auto flex min-h-[500px] w-full max-w-[1100px] items-center justify-center rounded-[58px] bg-white px-8 py-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:min-h-[684px]">
      <div className="w-full max-w-[670px]">
        <h1 className="mb-16 text-center text-[2.6rem] font-bold text-black text-balance">
          RESET PASSWORD
        </h1>

        <div className="space-y-8">
          <div className="grid items-center gap-4 md:grid-cols-[120px_1fr]">
            <label className="text-xl text-black" htmlFor="reset-email">
              Email:
            </label>
            <input
              id="reset-email"
              className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
            />
          </div>

          <div className="grid items-center gap-4 md:grid-cols-[120px_250px]">
            <label className="text-xl text-black" htmlFor="reset-otp">
              OTP:
            </label>
            <input
              id="reset-otp"
              className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
            />
          </div>

          <div className="grid items-center gap-4 md:grid-cols-[120px_250px]">
            <label className="text-xl text-black" htmlFor="reset-password">
              New Password:
            </label>
            <input
              id="reset-password"
              type="password"
              className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
            />
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <AuthButton>SIGN IN</AuthButton>
        </div>
      </div>
    </section>
  )
}
