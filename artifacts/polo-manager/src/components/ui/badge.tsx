import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[11px] font-sans font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-g700 text-white hover:bg-g900",
        secondary:
          "border-transparent bg-bg2 text-ink hover:bg-line",
        destructive:
          "border-transparent bg-live text-white hover:bg-live/80",
        outline: "text-ink border-line",
        live: "border-transparent bg-live text-white uppercase tracking-wider text-[10px]",
        status: "border-line2 bg-surface2 text-ink2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
