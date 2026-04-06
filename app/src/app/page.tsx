"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

const STEPS = [
  {
    num: "01",
    title: "Issue",
    desc: "Read your on-chain KYC SBT and mint a private credential. Your data is hashed with Poseidon and stored locally — never exposed.",
  },
  {
    num: "02",
    title: "Prove",
    desc: "Select which attributes to disclose. A Groth16 ZK proof is generated in your browser in ~3 seconds — no server involved.",
  },
  {
    num: "03",
    title: "Access",
    desc: "Submit your proof on-chain to access gated DeFi vaults, participate in anonymous governance, and more.",
  },
];

const TECH = [
  { label: "Groth16", desc: "9,993 constraint circuit with on-chain verification (~200K gas)" },
  { label: "Poseidon", desc: "Hash-based identity commitments and Merkle tree" },
  { label: "8-slot schema", desc: "Flexible credential format with 5 predicate types" },
  { label: "Nullifiers", desc: "Scope-bound double-use prevention" },
];

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      {/* Hero */}
      <div className="relative text-center mb-20 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
        <h1 className="relative text-6xl md:text-7xl font-bold font-heading mb-6 animate-fade-in-up">
          <span className="gradient-text">zk</span>Fabric
        </h1>
        <p className="relative text-xl text-[#71717a] max-w-2xl mx-auto animate-fade-in-up stagger-1">
          Zero-knowledge selective-disclosure identity for HashKey Chain.
          Prove who you are without revealing what you are.
        </p>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-3 gap-6 mb-20">
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            className={`bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-6 hover:border-violet-500/30 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up stagger-${i + 1}`}
          >
            <div className="text-4xl font-heading gradient-text mb-3">{step.num}</div>
            <h3 className="text-lg font-heading font-semibold mb-2">{step.title}</h3>
            <p className="text-sm text-[#71717a]">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Architecture */}
      <div className="bg-[#0a0b0d]/50 border border-[#1a1b23] rounded-xl p-8 mb-20 glow-border animate-fade-in-up stagger-4">
        <h2 className="text-xl font-heading font-semibold mb-5 gradient-text">Under the Hood</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-[#71717a]">
          {TECH.map((item) => (
            <div key={item.label} className="border-l-2 border-violet-500/30 pl-3">
              <span className="text-violet-400 font-heading">{item.label}</span> — {item.desc}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center animate-fade-in-up stagger-5">
        {isConnected ? (
          <Link
            href="/issue"
            className="inline-block px-8 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-heading uppercase tracking-wider text-sm font-semibold rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]"
          >
            Get Started — Issue a Credential
          </Link>
        ) : (
          <p className="text-[#3f3f46]">Connect your wallet to get started</p>
        )}
      </div>
    </div>
  );
}
