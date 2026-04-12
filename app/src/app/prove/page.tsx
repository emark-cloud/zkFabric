"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  setActiveWallet,
  loadIdentity,
  loadCredentials,
  loadTree,
  saveTree,
  loadLeafIndices,
  generateProofInBrowser,
  type Identity,
  type Credential,
  type Predicate,
  CredentialTree,
} from "@/lib/fabric";
import { CredentialCard } from "@/components/CredentialCard";
import { ProofBuilder } from "@/components/ProofBuilder";
import { StepIndicator } from "@/components/StepIndicator";
import { useToast } from "@/components/Toast";
import { useProof } from "@/components/ProofContext";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";

export default function ProvePage() {
  const { address, isConnected } = useAccount();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [tree, setTree] = useState<CredentialTree | null>(null);
  const [leafIndices, setLeafIndices] = useState<Map<string, number>>(new Map());

  const [selectedCredId, setSelectedCredId] = useState<string | null>(null);
  const [predicates, setPredicates] = useState<Predicate[]>([]);
  const SCOPE_PRESETS = [
    { label: "Gated Vault", value: "2472064934873437441964307081633511463815357146900708688403104743157998254321" },
    { label: "Custom", value: "" },
  ];
  const [scope, setScope] = useState(SCOPE_PRESETS[0].value);
  const [proofResult, setProofResult] = useState<any>(null);
  const [isProving, setIsProving] = useState(false);
  const [proofSubstep, setProofSubstep] = useState(0);
  const [proofTime, setProofTime] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { setLatestProof } = useProof();

  useEffect(() => {
    setActiveWallet(address);
    setIdentity(loadIdentity());
    const creds = loadCredentials();
    setCredentials(creds);
    setLeafIndices(loadLeafIndices());

    // Load the local tree and ensure all of the user's credentials are present.
    // syncTreeFromIndexer on the issue page can race with persistCredential and
    // overwrite the tree before the indexer has caught up, losing newly added
    // credentials. Re-adding them here restores the same insertion order and root.
    let currentTree = loadTree();
    if (currentTree) {
      let modified = false;
      for (const cred of creds) {
        if (currentTree.indexOf(cred.credentialHash) === -1) {
          currentTree.addCredential(cred.credentialHash);
          modified = true;
        }
      }
      if (modified) saveTree(currentTree);
      setTree(currentTree);
    }
  }, [address]);

  const selectedCred = credentials.find((c) => c.id === selectedCredId);

  const handleGenerateProof = async () => {
    if (!identity || !selectedCred || !tree) return;

    // Find the credential's actual position in the tree by searching for its hash,
    // rather than trusting the stored leafIndices map (which can be stale if the
    // tree was rebuilt from the indexer with a different insertion order).
    let leafIndex = tree.indexOf(selectedCred.credentialHash);
    if (leafIndex === -1) {
      // Fall back to stored index
      const stored = leafIndices.get(selectedCred.id);
      if (stored === undefined) {
        setError("Credential not found in the Merkle tree. Try re-issuing it.");
        return;
      }
      leafIndex = stored;
    }

    setIsProving(true);
    setProofSubstep(0);
    setError("");
    setProofResult(null);

    try {
      const merkleProof = tree.getMerkleProof(leafIndex);
      setProofSubstep(1); // Merkle proof ready

      const scopeBigInt = BigInt(scope);
      setTimeout(() => setProofSubstep(2), 200); // Computing witness

      const start = performance.now();
      setTimeout(() => setProofSubstep(3), 600); // Generating Groth16
      const result = await generateProofInBrowser(
        identity.privateKey,
        selectedCred.slots,
        merkleProof,
        scopeBigInt,
        predicates
      );
      const elapsed = performance.now() - start;

      setProofSubstep(4); // Done
      setProofTime(Math.round(elapsed));
      setProofResult(result);
      setLatestProof({
        proof: result.proof.map(String),
        publicSignals: result.publicSignals.map(String),
        scope,
      });
      toast("ZK proof generated!", "success");
    } catch (err: any) {
      setError(err.message || "Proof generation failed");
      toast("Proof generation failed", "error");
    } finally {
      setIsProving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-[#3f3f46]">
        Connect your wallet to generate proofs.
      </div>
    );
  }

  if (!identity || credentials.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState
          icon="🔑"
          title="No credentials found"
          description="Issue a credential first to generate proofs."
          actionHref="/issue"
          actionLabel="Go to Issue"
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold font-heading mb-6 animate-fade-in-up">Proof Composer</h1>

      <StepIndicator
        steps={["Select Credential", "Configure Predicates", "Generate Proof"]}
        currentStep={proofResult ? 3 : selectedCred ? (predicates.length > 0 ? 2 : 1) : 0}
      />

      {/* Step 1: Select credential */}
      <section className="mb-8 animate-fade-in-up stagger-1">
        <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
          Select Credential
        </h2>
        <div className="space-y-3">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              onClick={() => setSelectedCredId(cred.id)}
              className={`cursor-pointer transition-all duration-300 rounded-xl ${
                selectedCredId === cred.id
                  ? "glow-border animate-glow-pulse"
                  : "hover:border-violet-500/20"
              }`}
            >
              <CredentialCard credential={cred} />
            </div>
          ))}
        </div>
      </section>

      {/* Step 2: Configure predicates */}
      {selectedCred && (
        <section className="mb-8 animate-fade-in-up">
          <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
            Disclosure Predicates
          </h2>
          <p className="text-sm text-[#71717a] mb-4">
            Choose which attributes to prove. Only the predicate type and threshold
            are revealed — your actual values stay private.
          </p>
          <ProofBuilder onPredicatesChange={setPredicates} />
        </section>
      )}

      {/* Step 3: Scope + Generate */}
      {selectedCred && (
        <section className="mb-8 animate-fade-in-up">
          <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
            Generate Proof
          </h2>
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-[#71717a]">Target dApp:</label>
              <div className="flex gap-2">
                {SCOPE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setScope(preset.value)}
                    className={`px-3 py-1 text-xs font-heading uppercase tracking-wider rounded-lg border transition-all duration-200 ${
                      scope === preset.value || (preset.label === "Custom" && !SCOPE_PRESETS.slice(0, -1).some((p) => p.value === scope))
                        ? "border-violet-500/50 text-violet-400 bg-violet-500/10"
                        : "border-[#1a1b23] text-[#71717a] hover:border-[#2d2e3a]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="dApp identifier"
                className="bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading w-full transition-colors text-[#71717a] pr-28"
              />
              {SCOPE_PRESETS.slice(0, -1).some((p) => p.value === scope) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-heading uppercase tracking-widest px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                  {SCOPE_PRESETS.find((p) => p.value === scope)?.label}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleGenerateProof}
            disabled={isProving}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg font-heading uppercase tracking-wider text-sm font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
          >
            {isProving ? "Generating Proof..." : "Generate ZK Proof"}
          </button>

          {isProving && (
            <div className="mt-4 bg-[#0a0b0d] border border-[#1a1b23] rounded-lg p-4 space-y-2">
              {[
                "Preparing Merkle proof",
                "Computing witness",
                "Generating Groth16 proof",
                "Finalizing",
              ].map((step, i) => {
                const stepNum = i + 1;
                const isDone = proofSubstep > stepNum;
                const isActive = proofSubstep === stepNum || (stepNum === 3 && proofSubstep >= 3 && proofSubstep < 4);
                return (
                  <div key={step} className="flex items-center gap-3 text-sm">
                    {isDone ? (
                      <span className="text-green-400 text-xs">&#10003;</span>
                    ) : isActive ? (
                      <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-[#1a1b23] inline-block" />
                    )}
                    <span className={isDone ? "text-[#71717a]" : isActive ? "text-[#e4e4e7]" : "text-[#3f3f46]"}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="mb-8 bg-red-900/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400 animate-slide-down">
          {error}
        </div>
      )}

      {/* Proof Result */}
      {proofResult && (
        <section className="mb-8 animate-fade-in-up">
          <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa] font-heading">
            Proof Generated
            {proofTime && (
              <span className="text-sm text-[#71717a] font-normal ml-2">
                ({(proofTime / 1000).toFixed(1)}s)
              </span>
            )}
          </h2>

          <div className="bg-[#0a0b0d] border border-[#1a1b23] border-t-2 border-t-green-500 rounded-xl p-4 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#71717a]">All Predicates Pass</span>
                <span className="flex items-center gap-1.5">
                  {proofResult.publicSignals[0] === 1n && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-dot-pulse inline-block" />
                  )}
                  <span className={proofResult.publicSignals[0] === 1n ? "text-green-400" : "text-red-400"}>
                    {proofResult.publicSignals[0] === 1n ? "YES" : "NO"}
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <Tooltip term="A unique pseudonym for this identity + scope pair. Prevents double-use but can't be linked to your wallet.">
                  <span className="text-[#71717a]">Nullifier Hash</span>
                </Tooltip>
                <span className="font-heading text-xs text-violet-400">
                  {proofResult.publicSignals[2].toString().slice(0, 20)}...
                </span>
              </div>
              <div className="flex justify-between">
                <Tooltip term="The root of the credential tree. Proves your credential is registered without revealing which one.">
                  <span className="text-[#71717a]">Merkle Root</span>
                </Tooltip>
                <span className="font-heading text-xs text-[#71717a]">
                  {proofResult.publicSignals[1].toString().slice(0, 20)}...
                </span>
              </div>
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-[#3f3f46] hover:text-[#71717a] font-heading uppercase tracking-wider">
                Proof data (advanced)
              </summary>
              <pre className="mt-2 bg-[#050505] border border-[#1a1b23] rounded-lg p-3 overflow-x-auto text-[#71717a] max-h-64 font-heading text-[11px]">
                {JSON.stringify(
                  {
                    proof: proofResult.proof.map(String),
                    publicSignals: proofResult.publicSignals.map(String),
                  },
                  null,
                  2
                )}
              </pre>
            </details>

            <button
              onClick={() => {
                const json = JSON.stringify({
                  proof: proofResult.proof.map(String),
                  publicSignals: proofResult.publicSignals.map(String),
                });
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(json).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }).catch(() => {
                    // Fallback: select from hidden textarea
                    const ta = document.createElement("textarea");
                    ta.value = json;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                } else {
                  const ta = document.createElement("textarea");
                  ta.value = json;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="text-xs px-3 py-1.5 bg-[#111218] border border-[#1a1b23] hover:border-[#2d2e3a] rounded-lg transition-colors font-heading uppercase tracking-wider"
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
