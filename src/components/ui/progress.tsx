import * as React from "react";
import { cn } from "@/lib/utils";

function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-signal-strong transition-[width] duration-500 ease-out",
          barClassName,
        )}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export { Progress };
