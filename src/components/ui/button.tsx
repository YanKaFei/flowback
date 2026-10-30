import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-canvas shadow-sm hover:bg-ink-soft",
        signal:
          "bg-signal text-signal-ink shadow-[0_1px_0_0_rgba(27,28,30,0.12)] hover:bg-signal-strong",
        outline:
          "border border-line-strong bg-surface text-ink hover:border-ink/30 hover:bg-canvas",
        ghost: "text-ink-soft hover:bg-ink/[0.045] hover:text-ink",
        soft: "bg-ink/[0.055] text-ink hover:bg-ink/[0.09]",
        danger:
          "bg-risk text-white shadow-sm hover:bg-risk-strong",
        "danger-ghost":
          "text-risk hover:bg-risk-soft",
        link: "h-auto rounded-none p-0 text-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-12 px-5 text-[15px]",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
