"use client";

import Link from "next/link";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyState({ icon, title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border border-[#1a1b23] rounded-xl bg-[#0a0b0d]/50">
      <span className="text-4xl mb-4 opacity-30">{icon}</span>
      <h3 className="text-sm font-heading font-semibold text-[#a1a1aa] mb-1">{title}</h3>
      <p className="text-xs text-[#71717a] text-center max-w-xs mb-4">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="text-xs text-[#8b5cf6] hover:text-[#a78bfa] transition-colors underline underline-offset-2"
        >
          {actionLabel} &rarr;
        </Link>
      )}
    </div>
  );
}
