import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--brand)] text-white shadow hover:bg-[var(--brand-2)]",
        destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600",
        outline:
          "border border-[var(--brand)] bg-transparent text-[var(--brand)] shadow-sm hover:bg-[var(--sea-50)]",
        secondary:
          "bg-[var(--sea-100)] text-[var(--sea-800)] shadow-sm hover:bg-[var(--sea-200)]",
        ghost:
          "text-[var(--muted)] hover:bg-[var(--sea-50)] hover:text-[var(--brand)]",
        link: "text-[var(--brand)] underline-offset-4 hover:underline",
        gold: "bg-[var(--gold)] text-white hover:brightness-110 shadow-sm", // Gold accent button
      },
      size: {
        default: "h-12 px-6 py-2", // Spacious buttons
        sm: "h-9 rounded px-3 text-xs",
        lg: "h-14 rounded px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
