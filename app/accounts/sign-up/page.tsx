import AuthButton from '@/components/authButton'

export default function SignUpPage() {
  const fields = [
    'Account Number',
    'Account Name',
    'Branch',
    'Email',
    'Password',
    'Confirm Password'
  ]

  return (
    <section className="mx-auto min-h-[700px] w-full max-w-[1100px] rounded-[58px] bg-white px-8 py-9 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:min-h-[820px] lg:px-14">
      <div className="relative mx-auto w-full max-w-[860px]">
        <img
          src="/loginlogo.png"
          alt="Nova Bank"
          className="absolute left-0 top-0 hidden w-[128px] md:block"
        />

        <h1 className="mb-12 text-center text-[2.6rem] font-bold text-black text-balance">
          SIGN UP
        </h1>

        <div className="space-y-4">
          {fields.map((field) => {
            const fieldId = `sign-up-${field.toLowerCase().replaceAll(' ', '-')}`
            const isPassword = field.toLowerCase().includes('password')

            return (
              <div
                className="grid items-center gap-4 md:grid-cols-[180px_1fr]"
                key={field}
              >
                <label className="text-xl text-black" htmlFor={fieldId}>
                  {field} :
                </label>
                <input
                  id={fieldId}
                  type={isPassword ? 'password' : 'text'}
                  className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
                />
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <AuthButton>SIGN UP</AuthButton>
        </div>
      </div>
    </section>
  )
}
