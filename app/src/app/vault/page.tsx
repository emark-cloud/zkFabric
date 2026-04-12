"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS, GATED_VAULT_ABI, MOCK_ERC20_ABI } from "@/lib/contracts";
import { VaultDashboard } from "@/components/VaultDashboard";
import { useToast } from "@/components/Toast";

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("100");
  const [proofJson, setProofJson] = useState("");
  const { toast } = useToast();

  const contractsDeployed =
    CONTRACTS.gatedVault !== "0x0000000000000000000000000000000000000000";

  const { writeContract: mint, data: mintTxHash } = useWriteContract();
  const { isSuccess: mintConfirmed } = useWaitForTransactionReceipt({ hash: mintTxHash });

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: deposit, data: depositTxHash } = useWriteContract();
  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositTxHash });

  const handleMintTokens = () => {
    if (!address) return;
    toast("Minting test tokens...", "info");
    mint({
      address: CONTRACTS.mockERC20,
      abi: MOCK_ERC20_ABI,
      functionName: "mint",
      args: [address, parseEther("1000")],
    });
  };

  const handleApprove = () => {
    toast("Approving vault...", "info");
    approve({
      address: CONTRACTS.mockERC20,
      abi: MOCK_ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.gatedVault, parseEther(depositAmount)],
    });
  };

  const handleDeposit = () => {
    if (!proofJson) {
      toast("Paste your proof JSON first (from the Prove page).", "error");
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

      toast("Depositing with ZK proof...", "info");
      deposit({
        address: CONTRACTS.gatedVault,
        abi: GATED_VAULT_ABI,
        functionName: "depositWithProof",
        args: [parseEther(depositAmount), address!, proof, publicSignals],
      });
    } catch (err: any) {
      toast("Could not read the proof. Make sure you copied it correctly from the Prove page.", "error");
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-[#3f3f46]">
        Connect your wallet to access the vault.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold font-heading mb-4 animate-fade-in-up">Gated RWA Vault</h1>

      <p className="text-sm text-[#71717a] mb-8 animate-fade-in-up stagger-1">
        This ERC-4626 vault requires a valid ZK proof to deposit. Only users with
        a PREMIUM-tier KYC credential (slot[1] &ge; 3) can access it. Your identity
        and exact KYC data remain private.
      </p>

      {!contractsDeployed && (
        <div className="mb-8 bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-400 animate-slide-down">
          Contracts not deployed yet. The UI is ready — deploy to HashKey Chain
          Testnet and update addresses in <code className="font-heading">lib/contracts.ts</code>.
        </div>
      )}

      <VaultDashboard userAddress={address} />

      {/* Actions */}
      <div className="space-y-6">
        {/* Mint tokens */}
        <section className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-5 animate-fade-in-up stagger-4">
          <h3 className="font-semibold font-heading mb-3">
            <span className="text-violet-400 mr-2">01</span>Get Test Tokens
          </h3>
          <button
            onClick={handleMintTokens}
            disabled={!contractsDeployed}
            className="px-4 py-2 bg-[#111218] border border-[#1a1b23] hover:border-[#2d2e3a] disabled:opacity-30 rounded-lg text-sm font-heading transition-all duration-200"
          >
            Mint 1,000 MOCK Tokens
          </button>
          {mintConfirmed && (
            <span className="ml-3 text-sm text-green-400 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-dot-pulse inline-block" />
              Minted!
            </span>
          )}
        </section>

        {/* Approve + Deposit */}
        <section className="bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-5 animate-fade-in-up stagger-5">
          <h3 className="font-semibold font-heading mb-3">
            <span className="text-violet-400 mr-2">02</span>Deposit with ZK Proof
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#71717a] block mb-1">
                Deposit Amount
              </label>
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading w-40 transition-colors"
              />
              <span className="ml-2 text-sm text-[#71717a]">MOCK</span>
            </div>

            <div>
              <label className="text-sm text-[#71717a] block mb-1">
                Proof JSON
              </label>
              <textarea
                value={proofJson}
                onChange={(e) => setProofJson(e.target.value)}
                placeholder='{"proof": [...], "publicSignals": [...]}'
                rows={4}
                className="w-full bg-[#050505] text-xs rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading text-violet-400/80 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={!contractsDeployed}
                className="px-4 py-2 bg-[#111218] border border-[#1a1b23] hover:border-[#2d2e3a] disabled:opacity-30 rounded-lg text-sm font-heading transition-all duration-200"
              >
                Approve
              </button>
              {approveConfirmed && (
                <span className="text-sm text-green-400 self-center inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-dot-pulse inline-block" />
                  Approved!
                </span>
              )}
              <button
                onClick={handleDeposit}
                disabled={!contractsDeployed || !proofJson}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg text-sm font-heading font-semibold uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.25)]"
              >
                Deposit with Proof
              </button>
              {depositConfirmed && (
                <span className="text-sm text-green-400 self-center inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-dot-pulse inline-block" />
                  Deposited!
                </span>
              )}
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
