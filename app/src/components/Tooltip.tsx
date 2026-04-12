"use client";

import type { ReactNode } from "react";

interface TooltipProps {
  term: string;
  children: ReactNode;
}

export function Tooltip({ term, children }: TooltipProps) {
  return (
    <span className="tooltip-trigger">
      {children}
      <span className="tooltip-content">{term}</span>
    </span>
  );
}
