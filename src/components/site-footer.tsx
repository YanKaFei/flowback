import { BrandLockup } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="container flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
        <BrandLockup compact />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          本地 SQLite 持久化 · 无云端依赖 · 人工审核后入库
        </p>
      </div>
    </footer>
  );
}
