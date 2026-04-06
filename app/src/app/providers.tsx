"use client";

import dynamic from "next/dynamic";

// Fully client-side providers — prevents any SSR/prerender localStorage issues
const ClientProviders = dynamic(() => import("@/components/ClientProviders"), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
