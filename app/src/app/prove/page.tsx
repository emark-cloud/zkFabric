"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  loadIdentity,
  loadCredentials,
  loadTree,
  loadLeafIndices,
  generateProofInBrowser,
  type Identity,
  type Credential,
  type Predicate,
  CredentialTree,
} from "@/lib/fabric";
import { CredentialCard } from "@/components/CredentialCard";
import { ProofBuilder } from "@/components/ProofBuilder";

export default function ProvePage() {
  const { isConnected } = useAccount();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [tree, setTree] = useState<CredentialTree | null>(null);
  const [leafIndices, setLeafIndices] = useState<Map<string, number>>(new Map());

  const [selectedCredId, setSelectedCredId] = useState<string | null>(null);
  const [predicates, setPredicates] = useState<Predicate[]>([]);
  const [scope, setScope] = useState("1");
  const [proofResult, setProofResult] = useState<any>(null);
  const [isProving, setIsProving] = useState(false);
  const [proofTime, setProofTime] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setIdentity(loadIdentity());
    setCredentials(loadCredentials());
    setTree(loadTree());
    setLeafIndices(loadLeafIndices());
  }, []);

  const selectedCred = credentials.find((c) => c.id === selectedCredId);

  const handleGenerateProof = async () => {
    if (!identity || !selectedCred || !tree) return;

    const leafIndex = leafIndices.get(selectedCred.id);
    if (leafIndex === undefined) {
      setError("Leaf index not found for this credential");
      return;
    }

    setIsProving(true);
    setError("");
    setProofResult(null);

    try {
      const merkleProof = tree.getMerkleProof(leafIndex);
      const scopeBigInt = BigInt(scope);

      const start = performance.now();
      const result = await generateProofInBrowser(
        identity.privateKey,
        selectedCred.slots,
        merkleProof,
        scopeBigInt,
        predicates
      );
      const elapsed = performance.now() - start;

      setProofTime(Math.round(elapsed));
      setProofResult(result);
    } catch (err: any) {
      setError(err.message || "Proof generation failed");
    } finally {
      setIsProving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        Connect your wallet to generate proofs.
      </div>
    );
  }

  if (!identity || credentials.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        No credentials found. Go to{" "}
        <a href="/issue" className="text-violet-400 hover:underline">
          Issue
        </a>{" "}
        to create one first.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Proof Composer</h1>

      {/* Step 1: Select credential */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-300">
          Step 1: Select Credential
        </h2>
        <div className="space-y-3">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              onClick={() => setSelectedCredId(cred.id)}
              className={`cursor-pointer transition rounded-xl ${
                selectedCredId === cred.id
                  ? "ring-2 ring-violet-500"
                  : "hover:ring-1 hover:ring-gray-700"
              }`}
            >
              <CredentialCard credential={cred} />
            </div>
          ))}
        </div>
      </section>

      {/* Step 2: Configure predicates */}
      {selectedCred && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-300">
            Step 2: Select Disclosure Predicates
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose which attributes to prove. Only the predicate type and threshold
            are revealed — your actual values stay private.
          </p>
          <ProofBuilder onPredicatesChange={setPredicates} />
        </section>
      )}

      {/* Step 3: Scope + Generate */}
      {selectedCred && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-300">
            Step 3: Generate Proof
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm text-gray-400">Scope:</label>
            <input
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="dApp scope (number)"
              className="bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 font-mono w-48"
            />
          </div>

          <button
            onClick={handleGenerateProof}
            disabled={isProving}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold transition"
          >
            {isProving ? "Generating Proof..." : "Generate ZK Proof"}
          </button>

          {isProving && (
            <p className="mt-3 text-sm text-gray-400 animate-pulse">
              Computing Groth16 proof in browser — this may take a few seconds...
            </p>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="mb-8 bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Proof Result */}
      {proofResult && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-300">
            Proof Generated
            {proofTime && (
              <span className="text-sm text-gray-500 font-normal ml-2">
                ({(proofTime / 1000).toFixed(1)}s)
              </span>
            )}
          </h2>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            {/* Key signals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">All Predicates Pass</span>
                <span className={proofResult.publicSignals[0] === 1n ? "text-green-400" : "text-red-400"}>
                  {proofResult.publicSignals[0] === 1n ? "YES" : "NO"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Nullifier Hash</span>
                <span className="font-mono text-xs text-violet-400">
                  {proofResult.publicSignals[2].toString().slice(0, 20)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Merkle Root</span>
                <span className="font-mono text-xs text-gray-400">
                  {proofResult.publicSignals[1].toString().slice(0, 20)}...
                </span>
              </div>
            </div>

            {/* Raw JSON */}
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
                Raw proof JSON
              </summary>
              <pre className="mt-2 bg-gray-950 rounded p-3 overflow-x-auto text-gray-400 max-h-64">
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

            {/* Copy button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  JSON.stringify({
                    proof: proofResult.proof.map(String),
                    publicSignals: proofResult.publicSignals.map(String),
                  })
                );
              }}
              className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded transition"
            >
              Copy to Clipboard
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
