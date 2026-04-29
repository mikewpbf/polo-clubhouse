import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[8px] border border-line bg-white px-3 py-1 text-[14px] font-sans text-ink transition-colors file:border-0 file:bg-transparent file:text-[14px] file:font-medium placeholder:text-ink3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-g300/30 focus-visible:border-g300 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
