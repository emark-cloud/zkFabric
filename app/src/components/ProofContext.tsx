"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ProofData {
  proof: string[];
  publicSignals: string[];
  scope: string;
}

interface ProofContextType {
  latestProof: ProofData | null;
  setLatestProof: (data: ProofData) => void;
  clearProof: () => void;
}

const ProofCtx = createContext<ProofContextType>({
  latestProof: null,
  setLatestProof: () => {},
  clearProof: () => {},
});

export function useProof() {
  return useContext(ProofCtx);
}

export function ProofProvider({ children }: { children: ReactNode }) {
  const [latestProof, setProof] = useState<ProofData | null>(null);

  const setLatestProof = useCallback((data: ProofData) => setProof(data), []);
  const clearProof = useCallback(() => setProof(null), []);

  return (
    <ProofCtx.Provider value={{ latestProof, setLatestProof, clearProof }}>
      {children}
    </ProofCtx.Provider>
  );
}
