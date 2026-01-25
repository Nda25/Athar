import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--sea-600)] text-white hover:bg-[var(--sea-700)]",
        secondary:
          "border-transparent bg-[var(--sea-50)] text-[var(--sea-700)] hover:bg-[var(--sea-100)]",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-600",
        outline: "text-[var(--ink)] border-[var(--sea-200)]",
        gold: "border-transparent bg-[var(--gold)] text-white hover:brightness-95",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
