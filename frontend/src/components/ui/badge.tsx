import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#F3B450] text-[#0C0A04] [a&]:hover:bg-[#F3BC56]",
        secondary:
          "border-transparent bg-gray-100 text-gray-700 [a&]:hover:bg-gray-200",
        destructive:
          "border-transparent bg-red-500 text-white [a&]:hover:bg-red-600",
        outline:
          "border-gray-300 text-gray-700 [a&]:hover:bg-gray-50",
        success:
          "border-transparent bg-green-500 text-white [a&]:hover:bg-green-600",
        warning:
          "border-transparent bg-amber-500 text-white [a&]:hover:bg-amber-600",
        info:
          "border-transparent bg-blue-500 text-white [a&]:hover:bg-blue-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
