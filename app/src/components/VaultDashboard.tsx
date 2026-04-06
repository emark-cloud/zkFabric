"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, GATED_VAULT_ABI, MOCK_ERC20_ABI } from "@/lib/contracts";
import { formatEther } from "viem";

interface Props {
  userAddress?: `0x${string}`;
}

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

  const { data: vaultScope } = useReadContract({
    address: CONTRACTS.gatedVault,
    abi: GATED_VAULT_ABI,
    functionName: "SCOPE",
    query: { enabled: contractsDeployed },
  });

  return (
    <div className="grid sm:grid-cols-3 gap-4 mb-8">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          Total Vault Assets
        </p>
        <p className="text-2xl font-bold text-violet-400">
          {totalAssets ? formatEther(totalAssets as bigint) : "0"}{" "}
          <span className="text-sm text-gray-500">MOCK</span>
        </p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          Your Token Balance
        </p>
        <p className="text-2xl font-bold">
          {userBalance ? formatEther(userBalance as bigint) : "0"}{" "}
          <span className="text-sm text-gray-500">MOCK</span>
        </p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          Vault Scope
        </p>
        <p className="text-sm font-mono text-gray-400 break-all">
          {vaultScope ? (vaultScope as bigint).toString().slice(0, 20) + "..." : "N/A"}
        </p>
      </div>
    </div>
  );
}
