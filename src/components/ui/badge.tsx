import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "border-ink/15 bg-ink text-canvas",
        outline: "border-line-strong bg-surface text-ink-soft",
        muted: "border-transparent bg-ink/[0.055] text-ink-muted",
        signal: "border-signal-strong/40 bg-signal-soft text-signal-ink",
        risk: "border-risk-border bg-risk-soft text-risk-strong",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        blue: "border-blue-200 bg-blue-50 text-blue-800",
        ok: "border-ok-border bg-ok-soft text-ok",
        dashed: "border-dashed border-line-strong bg-transparent text-ink-muted",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
