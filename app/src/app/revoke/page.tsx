"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { CONTRACTS, REVOCATION_ABI } from "@/lib/contracts";
import { INDEXER_URL } from "@/lib/fabric";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";

type Leaf = { hash: string; revoked: boolean };

export default function RevokePage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexerError, setIndexerError] = useState("");
  const [rootInput, setRootInput] = useState("");
  const [nullifierInput, setNullifierInput] = useState("");
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const { writeContract: revokeHash, data: revokeTx } = useWriteContract();
  const { isSuccess: revokeConfirmed } = useWaitForTransactionReceipt({ hash: revokeTx });
  const { writeContract: revokeRoot, data: rootTx } = useWriteContract();
  const { isSuccess: rootConfirmed } = useWaitForTransactionReceipt({ hash: rootTx });
  const { writeContract: revokeNullifier, data: nullTx } = useWriteContract();
  const { isSuccess: nullConfirmed } = useWaitForTransactionReceipt({ hash: nullTx });

  async function loadLeaves() {
    if (!publicClient) return;
    setLoading(true);
    setIndexerError("");
    try {
      const res = await fetch(`${INDEXER_URL}/leaves`);
      if (!res.ok) throw new Error(`indexer ${res.status}`);
      const data = (await res.json()) as { leaves: string[] };

      // Check revocation status for each leaf in parallel.
      const statuses = await Promise.all(
        data.leaves.map((h) =>
          publicClient
            .readContract({
              address: CONTRACTS.revocation,
              abi: REVOCATION_ABI,
              functionName: "isRevoked",
              args: [BigInt(h)],
            })
            .then((r) => Boolean(r))
            .catch(() => false)
        )
      );
      setLeaves(
        data.leaves.map((hash, i) => ({ hash, revoked: statuses[i] })).reverse()
      );
    } catch (err: any) {
      setIndexerError(err.message || "indexer unreachable");
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  useEffect(() => {
    if (revokeConfirmed || rootConfirmed || nullConfirmed) {
      toast("Revocation confirmed on-chain.", "success");
      loadLeaves();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revokeConfirmed, rootConfirmed, nullConfirmed]);

  const handleRevokeCredential = (hash: string) => {
    setConfirmAction({
      title: "Revoke Credential",
      message: `This will permanently revoke credential ${hash.slice(0, 20)}... on-chain. Any proofs using this credential will be rejected.`,
      onConfirm: () => {
        toast(`Revoking credential ${hash.slice(0, 20)}...`, "info");
        revokeHash({
          address: CONTRACTS.revocation,
          abi: REVOCATION_ABI,
          functionName: "revoke",
          args: [BigInt(hash)],
        });
        setConfirmAction(null);
      },
    });
  };

  const handleRevokeRoot = () => {
    if (!rootInput.trim()) return;
    try {
      const v = BigInt(rootInput.trim());
      setConfirmAction({
        title: "Revoke Merkle Root",
        message: `This will invalidate ALL proofs built against this root. This action cannot be undone.`,
        onConfirm: () => {
          toast(`Revoking Merkle root ${rootInput.slice(0, 20)}...`, "info");
          revokeRoot({
            address: CONTRACTS.revocation,
            abi: REVOCATION_ABI,
            functionName: "revokeRoot",
            args: [v],
          });
          setConfirmAction(null);
        },
      });
    } catch {
      toast("Invalid value. Paste the exact number from your system.", "error");
    }
  };

  const handleRevokeNullifier = () => {
    if (!nullifierInput.trim()) return;
    try {
      const v = BigInt(nullifierInput.trim());
      setConfirmAction({
        title: "Ban Nullifier",
        message: `This will permanently ban this nullifier. The identity behind it will never be able to prove in this scope again.`,
        onConfirm: () => {
          toast(`Revoking nullifier ${nullifierInput.slice(0, 20)}...`, "info");
          revokeNullifier({
            address: CONTRACTS.revocation,
            abi: REVOCATION_ABI,
            functionName: "revokeNullifier",
            args: [v],
          });
          setConfirmAction(null);
        },
      });
    } catch {
      toast("Invalid value. Paste the exact number from your system.", "error");
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-[#3f3f46]">
        Connect your wallet to use the issuer revocation dashboard.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold font-heading mb-2 animate-fade-in-up">
        Revocation Dashboard
      </h1>
      <p className="text-sm text-[#71717a] mb-8 animate-fade-in-up stagger-1">
        Issuer-only. Revoke credentials, roots, or nullifiers. Revocations
        take effect immediately — any proof using a revoked item is
        automatically rejected on-chain.
      </p>

      {/* Credential list from indexer */}
      <section className="mb-8 animate-fade-in-up stagger-2">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#a1a1aa] font-heading">
            Issued Credentials
          </h2>
          <button
            onClick={loadLeaves}
            className="text-xs font-heading uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
          >
            Refresh
          </button>
        </div>

        {indexerError && (
          <div className="mb-3 bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400">
            Indexer unreachable ({indexerError}). Set NEXT_PUBLIC_INDEXER_URL or
            run the indexer from the repo.
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#3f3f46]">Loading...</p>
        ) : leaves.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No credentials indexed"
            description="Issue a credential first, then it will appear here for revocation management."
            actionHref="/issue"
            actionLabel="Go to Issue"
          />
        ) : (
          <div className="space-y-2">
            {leaves.map((l) => (
              <div
                key={l.hash}
                className={`bg-[#0a0b0d] border rounded-lg p-3 flex items-center justify-between gap-3 ${
                  l.revoked ? "border-red-500/30" : "border-[#1a1b23]"
                }`}
              >
                <code className="text-xs text-violet-400 font-heading truncate">
                  {l.hash.slice(0, 28)}...{l.hash.slice(-6)}
                </code>
                {l.revoked ? (
                  <span className="text-[10px] font-heading uppercase tracking-widest px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full whitespace-nowrap">
                    Revoked
                  </span>
                ) : (
                  <button
                    onClick={() => handleRevokeCredential(l.hash)}
                    className="px-3 py-1 text-xs font-heading uppercase tracking-wider bg-[#111218] border border-[#1a1b23] hover:border-red-500/40 hover:text-red-400 rounded-lg transition-all"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Root revocation */}
      <section className="mb-8 animate-fade-in-up stagger-3">
        <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
          Revoke Merkle Root
        </h2>
        <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-4 space-y-3">
          <p className="text-xs text-[#71717a]">
            Invalidates every proof built against this root. Use after rotating
            out a compromised credential — issue a fresh root that excludes the
            leaf, then revoke the old one.
          </p>
          <input
            type="text"
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            placeholder="Merkle root value"
            className="w-full bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading"
          />
          <button
            onClick={handleRevokeRoot}
            disabled={!rootInput.trim()}
            className="px-4 py-2 text-xs font-heading uppercase tracking-wider bg-[#111218] border border-[#1a1b23] hover:border-red-500/40 hover:text-red-400 disabled:opacity-40 rounded-lg transition-all"
          >
            Revoke Root
          </button>
        </div>
      </section>

      {/* Nullifier revocation */}
      <section className="mb-8 animate-fade-in-up stagger-4">
        <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
          Ban Nullifier
        </h2>
        <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-4 space-y-3">
          <p className="text-xs text-[#71717a]">
            Defense-in-depth: if a nullifier was already observed using a
            revoked credential in a given scope, ban it directly so it can
            never be used again even if the attacker rebuilds the root.
          </p>
          <input
            type="text"
            value={nullifierInput}
            onChange={(e) => setNullifierInput(e.target.value)}
            placeholder="Nullifier value"
            className="w-full bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading"
          />
          <button
            onClick={handleRevokeNullifier}
            disabled={!nullifierInput.trim()}
            className="px-4 py-2 text-xs font-heading uppercase tracking-wider bg-[#111218] border border-[#1a1b23] hover:border-red-500/40 hover:text-red-400 disabled:opacity-40 rounded-lg transition-all"
          >
            Revoke Nullifier
          </button>
        </div>
      </section>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel="Revoke"
          variant="danger"
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
