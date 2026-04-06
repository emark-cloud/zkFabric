"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, KYC_SBT_ABI, KYC_ADAPTER_ABI } from "@/lib/contracts";
import {
  createIdentity,
  computeCredentialHash,
  packKycSlots,
  CredentialTree,
  CredentialType,
  saveIdentity,
  loadIdentity,
  saveCredentials,
  loadCredentials,
  saveTree,
  loadTree,
  saveLeafIndices,
  loadLeafIndices,
  type Identity,
  type Credential,
  type KycInfo,
} from "@/lib/fabric";
import { CredentialCard } from "@/components/CredentialCard";

export default function IssuePage() {
  const { address, isConnected } = useAccount();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [tree, setTree] = useState<CredentialTree | null>(null);
  const [leafIndices, setLeafIndices] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Load persisted state
  useEffect(() => {
    const id = loadIdentity();
    if (id) setIdentity(id);
    setCredentials(loadCredentials());
    setTree(loadTree() || new CredentialTree());
    setLeafIndices(loadLeafIndices());
  }, []);

  // Read KYC SBT info
  const { data: kycData } = useReadContract({
    address: CONTRACTS.kycSBT,
    abi: KYC_SBT_ABI,
    functionName: "getKycInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address && CONTRACTS.kycSBT !== "0x0000000000000000000000000000000000000000" },
  });

  // Contract write hooks
  const { writeContract: ingestOnChain, data: ingestTxHash } = useWriteContract();
  const { writeContract: registerHash, data: registerTxHash } = useWriteContract();

  const { isSuccess: ingestConfirmed } = useWaitForTransactionReceipt({ hash: ingestTxHash });
  const { isSuccess: registerConfirmed } = useWaitForTransactionReceipt({ hash: registerTxHash });

  const kycInfo: KycInfo | null = kycData
    ? {
        ensName: (kycData as any)[0] as string,
        level: Number((kycData as any)[1]),
        status: Number((kycData as any)[2]),
        createTime: BigInt((kycData as any)[3]),
      }
    : null;

  const isApproved = kycInfo && kycInfo.status === 1 && kycInfo.level >= 1;

  // Create or load identity
  const handleCreateIdentity = useCallback(() => {
    const id = createIdentity();
    setIdentity(id);
    saveIdentity(id);
    setStatus("Identity created! Commitment: " + id.commitment.toString().slice(0, 20) + "...");
  }, []);

  // Issue credential from KYC data
  const handleIssueCredential = useCallback(async () => {
    if (!identity || !kycInfo || !tree) return;
    setIsProcessing(true);
    setStatus("Packing credential data...");

    try {
      const slots = packKycSlots(kycInfo, 344n, 1n); // 344 = HK jurisdiction
      const credentialHash = computeCredentialHash(identity.commitment, slots);

      const credId = `kyc-${Date.now()}`;
      const credential: Credential = {
        id: credId,
        type: CredentialType.KYC_SBT,
        identityCommitment: identity.commitment,
        credentialHash,
        slots,
        createdAt: Date.now(),
      };

      // Add to tree
      const leafIndex = tree.addCredential(credentialHash);
      const newLeafIndices = new Map(leafIndices);
      newLeafIndices.set(credId, leafIndex);

      // Update state
      const newCredentials = [...credentials, credential];
      setCredentials(newCredentials);
      setLeafIndices(newLeafIndices);

      // Persist
      saveCredentials(newCredentials);
      saveTree(tree);
      saveLeafIndices(newLeafIndices);

      setStatus("Credential created locally! Hash: " + credentialHash.toString().slice(0, 20) + "...");

      // Register on-chain if contracts are deployed
      if (CONTRACTS.kycAdapter !== "0x0000000000000000000000000000000000000000" && address) {
        setStatus("Registering on-chain via KYCSBTAdapter...");
        ingestOnChain({
          address: CONTRACTS.kycAdapter,
          abi: KYC_ADAPTER_ABI,
          functionName: "ingestCredential",
          args: [address, identity.commitment],
        });
      }
    } catch (err: any) {
      setStatus("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [identity, kycInfo, tree, credentials, leafIndices, address, ingestOnChain]);

  // Handle on-chain registration confirmation
  useEffect(() => {
    if (ingestConfirmed && credentials.length > 0) {
      const latest = credentials[credentials.length - 1];
      setStatus("On-chain identity registered! Now registering credential hash...");
      registerHash({
        address: CONTRACTS.kycAdapter,
        abi: KYC_ADAPTER_ABI,
        functionName: "registerComputedCredential",
        args: [identity!.commitment, latest.credentialHash],
      });
    }
  }, [ingestConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (registerConfirmed) {
      setStatus("Credential fully registered on-chain!");
    }
  }, [registerConfirmed]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        Connect your wallet to issue credentials.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Issue Credential</h1>

      {/* Step 1: Identity */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-300">Step 1: Identity</h2>
        {identity ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Identity commitment:</p>
            <p className="font-mono text-sm text-violet-400 break-all">
              {identity.commitment.toString()}
            </p>
          </div>
        ) : (
          <button
            onClick={handleCreateIdentity}
            className="px-6 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium transition"
          >
            Create Identity
          </button>
        )}
      </section>

      {/* Step 2: KYC Status */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-300">Step 2: KYC Status</h2>
        {kycInfo ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">ENS Name</span>
              <span>{kycInfo.ensName || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Level</span>
              <span>{["NONE", "BASIC", "ADVANCED", "PREMIUM", "ULTIMATE"][kycInfo.level]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className={isApproved ? "text-green-400" : "text-red-400"}>
                {["NONE", "APPROVED", "REVOKED"][kycInfo.status]}
              </span>
            </div>
          </div>
        ) : CONTRACTS.kycSBT === "0x0000000000000000000000000000000000000000" ? (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 text-sm text-yellow-400">
            KYC SBT contract not deployed yet. Using demo mode — click below to issue
            a sample credential with mock KYC data (PREMIUM tier, APPROVED).
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading KYC data...</p>
        )}
      </section>

      {/* Step 3: Issue */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-300">Step 3: Mint Credential</h2>
        {identity ? (
          <button
            onClick={() => {
              if (isApproved || CONTRACTS.kycSBT === "0x0000000000000000000000000000000000000000") {
                // If contracts aren't deployed, use demo data
                if (!kycInfo) {
                  const demoKyc: KycInfo = {
                    ensName: "demo.hsk",
                    level: 3,
                    status: 1,
                    createTime: BigInt(Math.floor(Date.now() / 1000)),
                  };
                  // Temporarily set kycInfo for demo
                  const slots = packKycSlots(demoKyc, 344n, 1n);
                  const credentialHash = computeCredentialHash(identity.commitment, slots);
                  const credId = `kyc-demo-${Date.now()}`;
                  const credential: Credential = {
                    id: credId,
                    type: CredentialType.KYC_SBT,
                    identityCommitment: identity.commitment,
                    credentialHash,
                    slots,
                    createdAt: Date.now(),
                  };
                  const currentTree = tree || new CredentialTree();
                  const leafIndex = currentTree.addCredential(credentialHash);
                  const newLeafIndices = new Map(leafIndices);
                  newLeafIndices.set(credId, leafIndex);
                  const newCredentials = [...credentials, credential];
                  setCredentials(newCredentials);
                  setTree(currentTree);
                  setLeafIndices(newLeafIndices);
                  saveCredentials(newCredentials);
                  saveTree(currentTree);
                  saveLeafIndices(newLeafIndices);
                  setStatus("Demo credential created! (PREMIUM tier, HK jurisdiction)");
                } else {
                  handleIssueCredential();
                }
              }
            }}
            disabled={isProcessing}
            className="px-6 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
          >
            {isProcessing ? "Processing..." : "Mint Private Credential"}
          </button>
        ) : (
          <p className="text-sm text-gray-500">Create an identity first.</p>
        )}
      </section>

      {/* Status */}
      {status && (
        <div className="mb-8 bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm text-gray-300">
          {status}
        </div>
      )}

      {/* Credentials */}
      {credentials.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Your Credentials</h2>
          <div className="space-y-4">
            {credentials.map((cred) => (
              <CredentialCard key={cred.id} credential={cred} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
