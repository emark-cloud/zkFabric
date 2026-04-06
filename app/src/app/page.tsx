"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-violet-400">zk</span>Fabric
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Zero-knowledge selective-disclosure identity for HashKey Chain.
          Prove who you are without revealing what you are.
        </p>
      </div>

      {/* How it works */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-3xl mb-3">1</div>
          <h3 className="text-lg font-semibold mb-2">Issue</h3>
          <p className="text-sm text-gray-400">
            Read your on-chain KYC SBT and mint a private credential.
            Your data is hashed with Poseidon and stored locally — never exposed.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-3xl mb-3">2</div>
          <h3 className="text-lg font-semibold mb-2">Prove</h3>
          <p className="text-sm text-gray-400">
            Select which attributes to disclose. A Groth16 ZK proof is generated
            in your browser in ~3 seconds — no server involved.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-3xl mb-3">3</div>
          <h3 className="text-lg font-semibold mb-2">Access</h3>
          <p className="text-sm text-gray-400">
            Submit your proof on-chain to access gated DeFi vaults,
            participate in anonymous governance, and more.
          </p>
        </div>
      </div>

      {/* Architecture highlights */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 mb-16">
        <h2 className="text-xl font-semibold mb-4">Under the Hood</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-400">
          <div>
            <span className="text-violet-400 font-mono">Groth16</span> — 9,993 constraint circuit with on-chain verification (~200K gas)
          </div>
          <div>
            <span className="text-violet-400 font-mono">Poseidon</span> — Hash-based identity commitments and Merkle tree
          </div>
          <div>
            <span className="text-violet-400 font-mono">8-slot schema</span> — Flexible credential format with 5 predicate types
          </div>
          <div>
            <span className="text-violet-400 font-mono">Nullifiers</span> — Scope-bound double-use prevention
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        {isConnected ? (
          <Link
            href="/issue"
            className="inline-block px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition"
          >
            Get Started — Issue a Credential
          </Link>
        ) : (
          <p className="text-gray-500">Connect your wallet to get started</p>
        )}
      </div>
    </div>
  );
}
