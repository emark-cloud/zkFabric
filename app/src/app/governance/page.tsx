"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { CONTRACTS, GOVERNANCE_ABI } from "@/lib/contracts";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";

const BN128_FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Mirrors PrivateGovernance.getProposalScope — keccak256("zkfabric-governance-v1" || proposalId) % p.
function computeScope(proposalId: bigint): bigint {
  const packed = encodePacked(
    ["string", "uint256"],
    ["zkfabric-governance-v1", proposalId]
  );
  return BigInt(keccak256(packed)) % BN128_FIELD_PRIME;
}

type Proposal = {
  id: bigint;
  description: string;
  yesVotes: bigint;
  noVotes: bigint;
  deadline: bigint;
  exists: boolean;
};

export default function GovernancePage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDescription, setNewDescription] = useState("");
  const [newDurationHours, setNewDurationHours] = useState("24");
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [proofJson, setProofJson] = useState("");
  const [choice, setChoice] = useState<0 | 1>(1);
  const [copiedScope, setCopiedScope] = useState(false);
  const { toast } = useToast();

  const { writeContract: createProposal, data: createTx } = useWriteContract();
  const { isSuccess: createConfirmed } = useWaitForTransactionReceipt({ hash: createTx });
  const { writeContract: castVote, data: voteTx } = useWriteContract();
  const { isSuccess: voteConfirmed } = useWaitForTransactionReceipt({ hash: voteTx });

  async function loadProposals() {
    if (!publicClient) return;
    setLoading(true);
    try {
      const count = (await publicClient.readContract({
        address: CONTRACTS.governance,
        abi: GOVERNANCE_ABI,
        functionName: "proposalCount",
      })) as bigint;

      const list: Proposal[] = [];
      for (let i = 0n; i < count; i++) {
        const p = (await publicClient.readContract({
          address: CONTRACTS.governance,
          abi: GOVERNANCE_ABI,
          functionName: "proposals",
          args: [i],
        })) as unknown as readonly [string, bigint, bigint, bigint, boolean];
        list.push({
          id: i,
          description: p[0],
          yesVotes: p[1],
          noVotes: p[2],
          deadline: p[3],
          exists: p[4],
        });
      }
      setProposals(list.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  useEffect(() => {
    if (createConfirmed || voteConfirmed) loadProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createConfirmed, voteConfirmed]);

  const handleCreate = () => {
    if (!newDescription.trim()) return;
    const durationSeconds = BigInt(Math.max(1, Number(newDurationHours))) * 3600n;
    toast("Submitting proposal...", "info");
    createProposal({
      address: CONTRACTS.governance,
      abi: GOVERNANCE_ABI,
      functionName: "createProposal",
      args: [newDescription.trim(), durationSeconds],
    });
  };

  const handleVote = () => {
    if (selectedId === null) {
      toast("Select a proposal first.", "error");
      return;
    }
    if (!proofJson) {
      toast("Paste a proof JSON from the Prove page (use this proposal's scope).", "error");
      return;
    }
    try {
      const parsed = JSON.parse(proofJson);
      const proof = parsed.proof.map(BigInt) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
      const publicSignals = parsed.publicSignals.map(BigInt) as bigint[];
      if (proof.length !== 8 || publicSignals.length !== 52) {
        toast("Invalid proof format. Copy the complete proof from the Prove page.", "error");
        return;
      }
      toast(`Casting ${choice === 1 ? "YES" : "NO"} vote on proposal #${selectedId}...`, "info");
      castVote({
        address: CONTRACTS.governance,
        abi: GOVERNANCE_ABI,
        functionName: "vote",
        args: [selectedId, choice, proof, publicSignals],
      });
    } catch (err: any) {
      toast("Could not read the proof. Make sure you copied it correctly from the Prove page.", "error");
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-[#3f3f46]">
        Connect your wallet to participate in governance.
      </div>
    );
  }

  const selected = proposals.find((p) => p.id === selectedId);
  const selectedScope = selectedId !== null ? computeScope(selectedId) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold font-heading mb-2 animate-fade-in-up">Private Governance</h1>
      <p className="text-sm text-[#71717a] mb-8 animate-fade-in-up stagger-1">
        Anonymous voting with a ZK proof of credential ownership. Each identity gets
        one vote per proposal — nullifiers are scoped per-proposal so your votes are
        unlinkable across proposals.
      </p>

      {/* Create proposal */}
      <section className="mb-8 animate-fade-in-up stagger-2">
        <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
          Create Proposal
        </h2>
        <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-4 space-y-3">
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            placeholder="What should the DAO decide?"
            className="w-full bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none transition-colors"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#71717a]">Duration:</label>
            <input
              type="number"
              min={1}
              value={newDurationHours}
              onChange={(e) => setNewDurationHours(e.target.value)}
              className="bg-[#050505] text-sm rounded px-3 py-1 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none w-24"
            />
            <span className="text-sm text-[#71717a]">hours</span>
          </div>
          <button
            onClick={handleCreate}
            disabled={!newDescription.trim()}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg font-heading uppercase tracking-wider text-xs font-semibold transition-all"
          >
            Create
          </button>
        </div>
      </section>

      {/* Proposals list */}
      <section className="mb-8 animate-fade-in-up stagger-3">
        <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
          Proposals
        </h2>
        {loading ? (
          <p className="text-sm text-[#3f3f46]">Loading...</p>
        ) : proposals.length === 0 ? (
          <EmptyState
            icon="🗳️"
            title="No proposals yet"
            description="Create a proposal above to start anonymous governance."
          />
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => {
              const ended = p.deadline * 1000n < BigInt(Date.now());
              const total = p.yesVotes + p.noVotes;
              const yesPct = total > 0n ? Number((p.yesVotes * 100n) / total) : 0;
              const isSelected = selectedId === p.id;
              return (
                <div
                  key={p.id.toString()}
                  onClick={() => setSelectedId(p.id)}
                  className={`cursor-pointer bg-[#0a0b0d] border rounded-xl p-4 transition-all ${
                    isSelected
                      ? "border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                      : "border-[#1a1b23] hover:border-[#2d2e3a]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-xs font-heading text-[#3f3f46] uppercase tracking-wider">
                        Proposal #{p.id.toString()}
                      </p>
                      <p className="text-sm text-white mt-1">{p.description}</p>
                    </div>
                    <span
                      className={`text-[10px] font-heading uppercase tracking-widest px-2 py-1 rounded-full border ${
                        ended
                          ? "bg-[#111218] border-[#1a1b23] text-[#71717a]"
                          : "bg-green-500/10 border-green-500/20 text-green-400"
                      }`}
                    >
                      {ended ? "Ended" : "Active"}
                    </span>
                  </div>
                  <div className="text-xs text-[#71717a] space-y-1">
                    <div className="flex justify-between">
                      <span>
                        YES {p.yesVotes.toString()} · NO {p.noVotes.toString()}
                      </span>
                      <span>
                        {total > 0n ? `${yesPct}% yes` : "no votes"}
                      </span>
                    </div>
                    <div className="h-1 bg-[#111218] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
                        style={{ width: `${yesPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Vote panel */}
      {selected && (
        <section className="mb-8 animate-fade-in-up">
          <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
            Vote on #{selected.id.toString()}
          </h2>
          <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs text-[#71717a] font-heading uppercase tracking-wider block mb-1">
                Proposal scope (use this on the Prove page)
              </label>
              <div className="flex gap-2">
                <code className="flex-1 bg-[#050505] border border-[#1a1b23] rounded px-3 py-2 text-xs text-violet-400 overflow-x-auto font-heading">
                  {selectedScope?.toString()}
                </code>
                <button
                  onClick={() => {
                    if (!selectedScope) return;
                    const s = selectedScope.toString();
                    navigator.clipboard?.writeText(s).catch(() => {
                      const ta = document.createElement("textarea");
                      ta.value = s;
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand("copy");
                      document.body.removeChild(ta);
                    });
                    setCopiedScope(true);
                    setTimeout(() => setCopiedScope(false), 2000);
                  }}
                  className="px-3 py-1.5 text-xs bg-[#111218] border border-[#1a1b23] hover:border-[#2d2e3a] rounded-lg font-heading uppercase tracking-wider transition-colors"
                >
                  {copiedScope ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-[#3f3f46] mt-2">
                On the Prove page, pick this proposal's scope, generate a proof, then paste it below.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setChoice(1)}
                className={`flex-1 px-4 py-2 rounded-lg font-heading uppercase tracking-wider text-xs border transition-all ${
                  choice === 1
                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                    : "border-[#1a1b23] text-[#71717a] hover:border-[#2d2e3a]"
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setChoice(0)}
                className={`flex-1 px-4 py-2 rounded-lg font-heading uppercase tracking-wider text-xs border transition-all ${
                  choice === 0
                    ? "border-red-500/50 text-red-400 bg-red-500/10"
                    : "border-[#1a1b23] text-[#71717a] hover:border-[#2d2e3a]"
                }`}
              >
                NO
              </button>
            </div>

            <textarea
              value={proofJson}
              onChange={(e) => setProofJson(e.target.value)}
              placeholder='{"proof": [...], "publicSignals": [...]}'
              rows={4}
              className="w-full bg-[#050505] text-xs rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading text-violet-400/80 transition-colors"
            />

            <button
              onClick={handleVote}
              disabled={!proofJson}
              className="px-6 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg font-heading uppercase tracking-wider text-xs font-semibold transition-all shadow-[0_0_15px_rgba(139,92,246,0.25)]"
            >
              Cast Vote
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
