"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, GATED_VAULT_ABI, MOCK_ERC20_ABI } from "@/lib/contracts";
import { formatEther } from "viem";

interface Props {
  userAddress?: `0x${string}`;
}

const CARDS = [
  { label: "Total Vault Assets", border: "border-l-violet-500", color: "text-violet-400" },
  { label: "Your Token Balance", border: "border-l-cyan-500", color: "text-cyan-400" },
  { label: "Access Requirement", border: "border-l-green-500", color: "" },
];

export function VaultDashboard({ userAddress }: Props) {
  const contractsDeployed =
    CONTRACTS.gatedVault !== "0x0000000000000000000000000000000000000000";

  const { data: totalAssets } = useReadContract({
    address: CONTRACTS.gatedVault,
    abi: GATED_VAULT_ABI,
    functionName: "totalAssets",
    query: { enabled: contractsDeployed },
  });

  const { data: userBalance } = useReadContract({
    address: CONTRACTS.mockERC20,
    abi: MOCK_ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: contractsDeployed && !!userAddress },
  });

  const values = [
    <span key="assets">{totalAssets ? formatEther(totalAssets as bigint) : "0"} <span className="text-sm text-[#71717a]">MOCK</span></span>,
    <span key="balance">{userBalance ? formatEther(userBalance as bigint) : "0"} <span className="text-sm text-[#71717a]">MOCK</span></span>,
    <span key="requirement" className="text-sm font-heading text-green-400">KYC PREMIUM+</span>,
  ];

  return (
    <div className="grid sm:grid-cols-3 gap-4 mb-8">
      {CARDS.map((card, i) => (
        <div
          key={card.label}
          className={`bg-[#0a0b0d] border border-[#1a1b23] border-l-2 ${card.border} rounded-xl p-5 hover:border-[#2d2e3a] transition-all duration-300 animate-fade-in-up stagger-${i + 1}`}
        >
          <p className="text-[10px] font-heading text-[#71717a] uppercase tracking-widest mb-1">
            {card.label}
          </p>
          <p className={`text-2xl font-bold font-heading ${card.color}`}>
            {values[i]}
          </p>
        </div>
      ))}
    </div>
  );
}
