import type { ButtonHTMLAttributes } from 'react'

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export default function AuthButton({
  className = '',
  type = 'button',
  ...props
}: AuthButtonProps) {
  return (
    <button
      type={type}
      className={`h-[82px] w-[228px] rounded-[38px] bg-[rgba(147,85,146,0.76)] text-[1.85rem] font-bold text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.30),0_8px_12px_6px_rgba(0,0,0,0.15)] transition-[background-color,box-shadow] duration-150 ease-out hover:bg-[rgba(120,63,119,0.86)] hover:shadow-[0_4px_4px_0_rgba(0,0,0,0.26),0_8px_12px_6px_rgba(0,0,0,0.13)] active:bg-[rgba(101,50,100,0.9)] ${className}`}
      {...props}
    />
  )
}
