import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-gray-900 placeholder:text-gray-400 selection:bg-[#F3B450]/30 selection:text-gray-900 border-gray-300 h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base text-gray-900 shadow-xs transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[#F3B450] focus-visible:ring-[#F3B450]/20 focus-visible:ring-[3px]",
        "hover:border-gray-400",
        "aria-invalid:ring-red-500/20 aria-invalid:border-red-500",
        className
      )}
      {...props}
    />
  )
}

export { Input }
