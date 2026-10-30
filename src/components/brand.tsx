import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="9" fill="#1B1C1E" />
      <path
        d="M10.5 22.5V9.5H20"
        stroke="#C9F24E"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10.5 16.2H17"
        stroke="#C9F24E"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M20.5 16.5L18 19M20.5 16.5L18 14"
        stroke="#C9F24E"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLockup({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          FlowBack
        </span>
        {compact ? null : (
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
            Echo · 回响
          </span>
        )}
      </span>
    </span>
  );
}
