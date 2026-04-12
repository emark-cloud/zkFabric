"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

const PROBLEMS = [
  {
    before: "Binary KYC",
    problem: "Current systems tell dApps everything about you just to prove one thing. A lending protocol doesn't need your passport — it needs to know you're creditworthy.",
  },
  {
    before: "Siloed credentials",
    problem: "Verified on one platform? Start over on the next. Every dApp builds its own identity silo, and users re-do KYC each time.",
  },
  {
    before: "No standard",
    problem: "Developers integrate bespoke identity solutions for each provider. There's no universal interface that just works.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Issue",
    desc: "Connect your wallet and import your KYC credential. Your personal data is cryptographically committed and stored only on your device — it never leaves your browser.",
    detail: "Supports HashKey KYC SBT and off-chain credentials via zkTLS attestation.",
  },
  {
    num: "02",
    title: "Prove",
    desc: "Choose exactly what to reveal: \"My KYC level is 3 or above\" without showing your actual level, name, or any other detail. A zero-knowledge proof is generated in your browser in seconds.",
    detail: "No server sees your data. The proof is mathematically verifiable but reveals nothing else.",
  },
  {
    num: "03",
    title: "Access",
    desc: "Submit your proof on-chain. The smart contract verifies the math and grants access — to a DeFi vault, a governance vote, or any gated application.",
    detail: "One proof format works across every dApp on HashKey Chain.",
  },
];

const USE_CASES = [
  {
    title: "DeFi lending",
    question: "\"Is this user KYC tier 3 or above?\"",
    answer: "YES. Identity: unknown.",
    icon: "🏦",
  },
  {
    title: "Governance",
    question: "\"Is this a unique verified human?\"",
    answer: "YES. Identity: unknown.",
    icon: "🗳️",
  },
  {
    title: "RWA vaults",
    question: "\"Is this user in an eligible jurisdiction?\"",
    answer: "YES. Identity: unknown.",
    icon: "🔐",
  },
  {
    title: "PayFi",
    question: "\"Does this user meet compliance requirements?\"",
    answer: "YES. Identity: unknown.",
    icon: "💳",
  },
];

const TECH = [
  { label: "Groth16", desc: "9,993-constraint ZK circuit verified on-chain (~200K gas)" },
  { label: "Poseidon hash", desc: "ZK-friendly cryptographic commitments" },
  { label: "8-slot credentials", desc: "Flexible schema supporting 5 predicate types" },
  { label: "Nullifiers", desc: "One vote per person, unlinkable across scopes" },
  { label: "BIP39 recovery", desc: "12-word seed phrase backs up your identity" },
  { label: "On-chain revocation", desc: "Issuers can revoke compromised credentials" },
];

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      {/* Hero */}
      <div className="relative text-center mb-24 overflow-hidden">
        <div className="absolute -top-24 left-1/2 w-[28rem] h-[28rem] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" style={{ animation: "blobRotate 20s linear infinite" }} />
        <div className="absolute -top-16 left-1/2 w-[22rem] h-[22rem] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" style={{ animation: "blobRotate 25s linear infinite reverse", marginLeft: "4rem" }} />
        <h1 className="relative text-6xl md:text-7xl font-bold font-heading mb-6 animate-fade-in-up">
          <span className="gradient-text">zk</span>Fabric
        </h1>
        <p className="relative text-xl text-[#a1a1aa] max-w-2xl mx-auto mb-4 animate-fade-in-up stagger-1">
          Prove you qualify without revealing who you are.
        </p>
        <p className="relative text-sm text-[#71717a] max-w-xl mx-auto animate-fade-in-up stagger-2">
          zkFabric is a privacy layer for HashKey Chain. Get verified once, then
          generate tailored zero-knowledge proofs for any dApp — DeFi, governance,
          RWA — without ever exposing your personal data.
        </p>
      </div>

      {/* Problem */}
      <section className="mb-24 animate-fade-in-up stagger-2">
        <h2 className="text-xl font-heading font-semibold mb-2 text-center gradient-text">
          The Problem
        </h2>
        <p className="text-sm text-[#71717a] text-center mb-8 max-w-lg mx-auto">
          Web3 identity today forces a bad trade-off: comply and lose privacy, or stay private and lose access.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {PROBLEMS.map((p, i) => (
            <div
              key={i}
              className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-5"
            >
              <p className="text-xs font-heading uppercase tracking-wider text-red-400/80 mb-2">
                {p.before}
              </p>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">{p.problem}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mb-24">
        <h2 className="text-xl font-heading font-semibold mb-2 text-center gradient-text animate-fade-in-up stagger-2">
          How It Works
        </h2>
        <p className="text-sm text-[#71717a] text-center mb-8 max-w-lg mx-auto animate-fade-in-up stagger-2">
          Three steps. Your data stays on your device the entire time.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-6 hover:border-violet-500/30 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up stagger-${i + 1}`}
            >
              <div className="text-4xl font-heading gradient-text mb-3">{step.num}</div>
              <h3 className="text-lg font-heading font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed mb-3">{step.desc}</p>
              <p className="text-xs text-[#3f3f46] leading-relaxed">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="mb-24 animate-fade-in-up stagger-3">
        <h2 className="text-xl font-heading font-semibold mb-2 text-center gradient-text">
          What dApps See
        </h2>
        <p className="text-sm text-[#71717a] text-center mb-8 max-w-lg mx-auto">
          dApps ask a question. They get a verified yes or no. They never learn who you are.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-5 flex gap-4 items-start"
            >
              <span className="text-2xl mt-0.5">{uc.icon}</span>
              <div>
                <p className="text-sm font-heading font-semibold mb-1">{uc.title}</p>
                <p className="text-sm text-violet-400/90 italic mb-1">{uc.question}</p>
                <p className="text-xs text-green-400/80 font-heading">{uc.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture / Tech */}
      <section className="mb-24 animate-fade-in-up stagger-4">
        <div className="bg-[#0a0b0d]/50 border border-[#1a1b23] rounded-xl p-8 glow-border">
          <h2 className="text-xl font-heading font-semibold mb-2 gradient-text">Under the Hood</h2>
          <p className="text-sm text-[#71717a] mb-5">
            Built on battle-tested cryptography. All proof generation happens client-side — no trusted server.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-[#71717a]">
            {TECH.map((item) => (
              <div key={item.label} className="border-l-2 border-violet-500/30 pl-3">
                <span className="text-violet-400 font-heading">{item.label}</span> — {item.desc}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for HashKey */}
      <section className="mb-24 animate-fade-in-up stagger-4">
        <div className="text-center">
          <h2 className="text-xl font-heading font-semibold mb-2 gradient-text">
            Native to HashKey Chain
          </h2>
          <p className="text-sm text-[#71717a] max-w-xl mx-auto leading-relaxed">
            zkFabric integrates directly with HashKey Chain's KYC SBT system — the same
            infrastructure backing 600K+ verified users on one of the world's largest regulated
            crypto exchanges. Your existing verification becomes a portable, private credential
            usable across the entire ecosystem.
          </p>
        </div>
      </section>

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
