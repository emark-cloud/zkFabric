"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS, GATED_VAULT_ABI, MOCK_ERC20_ABI } from "@/lib/contracts";
import { VaultDashboard } from "@/components/VaultDashboard";

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("100");
  const [proofJson, setProofJson] = useState("");
  const [status, setStatus] = useState("");

  const contractsDeployed =
    CONTRACTS.gatedVault !== "0x0000000000000000000000000000000000000000";

  // Mint tokens
  const { writeContract: mint, data: mintTxHash } = useWriteContract();
  const { isSuccess: mintConfirmed } = useWaitForTransactionReceipt({ hash: mintTxHash });

  // Approve tokens
  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // Deposit with proof
  const { writeContract: deposit, data: depositTxHash } = useWriteContract();
  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositTxHash });

  const handleMintTokens = () => {
    if (!address) return;
    setStatus("Minting test tokens...");
    mint({
      address: CONTRACTS.mockERC20,
      abi: MOCK_ERC20_ABI,
      functionName: "mint",
      args: [address, parseEther("1000")],
    });
  };

  const handleApprove = () => {
    setStatus("Approving vault to spend tokens...");
    approve({
      address: CONTRACTS.mockERC20,
      abi: MOCK_ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.gatedVault, parseEther(depositAmount)],
    });
  };

  const handleDeposit = () => {
    if (!proofJson) {
      setStatus("Paste your proof JSON first (from the Prove page).");
      return;
    }

    try {
      const parsed = JSON.parse(proofJson);
      const proof = parsed.proof.map(BigInt) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
      const publicSignals = parsed.publicSignals.map(BigInt) as bigint[];

      if (proof.length !== 8) {
        setStatus("Invalid proof: expected 8 elements");
        return;
      }
      if (publicSignals.length !== 52) {
        setStatus("Invalid public signals: expected 52 elements");
        return;
      }

      setStatus("Depositing with ZK proof...");
      deposit({
        address: CONTRACTS.gatedVault,
        abi: GATED_VAULT_ABI,
        functionName: "depositWithProof",
        args: [parseEther(depositAmount), address!, proof, publicSignals],
      });
    } catch (err: any) {
      setStatus("Invalid proof JSON: " + err.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        Connect your wallet to access the vault.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Gated RWA Vault</h1>

      <p className="text-sm text-gray-400 mb-8">
        This ERC-4626 vault requires a valid ZK proof to deposit. Only users with
        a PREMIUM-tier KYC credential (slot[1] &ge; 3) can access it. Your identity
        and exact KYC data remain private.
      </p>

      {!contractsDeployed && (
        <div className="mb-8 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 text-sm text-yellow-400">
          Contracts not deployed yet. The UI is ready — deploy to HashKey Chain
          Testnet and update addresses in <code>lib/contracts.ts</code>.
        </div>
      )}

      <VaultDashboard userAddress={address} />

      {/* Actions */}
      <div className="space-y-6">
        {/* Mint tokens */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3">1. Get Test Tokens</h3>
          <button
            onClick={handleMintTokens}
            disabled={!contractsDeployed}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm transition"
          >
            Mint 1,000 MOCK Tokens
          </button>
          {mintConfirmed && (
            <span className="ml-3 text-sm text-green-400">Minted!</span>
          )}
        </section>

        {/* Approve + Deposit */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3">2. Deposit with ZK Proof</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Deposit Amount
              </label>
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 font-mono w-40"
              />
              <span className="ml-2 text-sm text-gray-500">MOCK</span>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Proof JSON (paste from Prove page)
              </label>
              <textarea
                value={proofJson}
                onChange={(e) => setProofJson(e.target.value)}
                placeholder='{"proof": [...], "publicSignals": [...]}'
                rows={4}
                className="w-full bg-gray-800 text-xs rounded px-3 py-2 border border-gray-700 font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={!contractsDeployed}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm transition"
              >
                Approve
              </button>
              {approveConfirmed && (
                <span className="text-sm text-green-400 self-center">Approved!</span>
              )}
              <button
                onClick={handleDeposit}
                disabled={!contractsDeployed || !proofJson}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition"
              >
                Deposit with Proof
              </button>
              {depositConfirmed && (
                <span className="text-sm text-green-400 self-center">
                  Deposited!
                </span>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Status */}
      {status && (
        <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm text-gray-300">
          {status}
        </div>
      )}
    </div>
  );
}
