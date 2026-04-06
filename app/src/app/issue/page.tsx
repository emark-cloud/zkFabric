"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, KYC_SBT_ABI, KYC_ADAPTER_ABI, ZKTLS_ADAPTER_ABI } from "@/lib/contracts";
import {
  createIdentity,
  computeCredentialHash,
  packKycSlots,
  packZktlsSlots,
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
  type ZKTLSAttestation,
} from "@/lib/fabric";
import { CredentialCard } from "@/components/CredentialCard";

type Tab = "kyc" | "zktls";

export default function IssuePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("kyc");
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

  // Contract write hooks — KYC
  const { writeContract: ingestOnChain, data: ingestTxHash } = useWriteContract();
  const { writeContract: registerHash, data: registerTxHash } = useWriteContract();
  const { isSuccess: ingestConfirmed } = useWaitForTransactionReceipt({ hash: ingestTxHash });
  const { isSuccess: registerConfirmed } = useWaitForTransactionReceipt({ hash: registerTxHash });

  // Contract write hooks — zkTLS
  const { writeContract: registerZktlsHash, data: zktlsRegisterTxHash } = useWriteContract();
  const { isSuccess: zktlsRegisterConfirmed } = useWaitForTransactionReceipt({ hash: zktlsRegisterTxHash });

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

  // Helper: persist a new credential
  const persistCredential = useCallback(
    (credential: Credential, currentTree: CredentialTree) => {
      const leafIndex = currentTree.addCredential(credential.credentialHash);
      const newLeafIndices = new Map(leafIndices);
      newLeafIndices.set(credential.id, leafIndex);
      const newCredentials = [...credentials, credential];
      setCredentials(newCredentials);
      setTree(currentTree);
      setLeafIndices(newLeafIndices);
      saveCredentials(newCredentials);
      saveTree(currentTree);
      saveLeafIndices(newLeafIndices);
      return newCredentials;
    },
    [credentials, leafIndices]
  );

  // Issue credential from KYC data
  const handleIssueCredential = useCallback(async () => {
    if (!identity || !kycInfo || !tree) return;
    setIsProcessing(true);
    setStatus("Packing credential data...");

    try {
      const slots = packKycSlots(kycInfo, 344n, 1n); // 344 = HK jurisdiction
      const credentialHash = computeCredentialHash(identity.commitment, slots);

      const credential: Credential = {
        id: `kyc-${Date.now()}`,
        type: CredentialType.KYC_SBT,
        identityCommitment: identity.commitment,
        credentialHash,
        slots,
        createdAt: Date.now(),
      };

      persistCredential(credential, tree);
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
  }, [identity, kycInfo, tree, address, ingestOnChain, persistCredential]);

  // Issue zkTLS credential (demo mode)
  const handleIssueZktls = useCallback(() => {
    if (!identity || !tree) return;
    setIsProcessing(true);
    setStatus("Creating zkTLS attestation credential...");

    try {
      const attestation: ZKTLSAttestation = {
        provider: "github-account-age",
        primaryAttribute: 3n, // score band 3 (e.g. account age > 2 years)
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        jurisdictionCode: 0n, // global
        auxiliaryData1: 2019n, // account creation year
        auxiliaryData2: 0n,
      };

      const slots = packZktlsSlots(attestation, 2n); // issuer=2 (Reclaim)
      const credentialHash = computeCredentialHash(identity.commitment, slots);

      const credential: Credential = {
        id: `zktls-demo-${Date.now()}`,
        type: CredentialType.ZKTLS,
        identityCommitment: identity.commitment,
        credentialHash,
        slots,
        createdAt: Date.now(),
      };

      persistCredential(credential, tree);
      setStatus("zkTLS credential created! Hash: " + credentialHash.toString().slice(0, 20) + "...");

      // Register on-chain if adapter is deployed
      if (CONTRACTS.zktlsAdapter !== "0x0000000000000000000000000000000000000000") {
        setStatus("Registering credential hash on-chain via ZKTLSAdapter...");
        registerZktlsHash({
          address: CONTRACTS.zktlsAdapter,
          abi: ZKTLS_ADAPTER_ABI,
          functionName: "registerComputedCredential",
          args: [identity.commitment, credentialHash],
        });
      }
    } catch (err: any) {
      setStatus("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [identity, tree, persistCredential, registerZktlsHash]);

  // Handle on-chain registration confirmation — KYC
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

  useEffect(() => {
    if (zktlsRegisterConfirmed) {
      setStatus("zkTLS credential registered on-chain!");
    }
  }, [zktlsRegisterConfirmed]);

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

      {/* Step 1: Identity (shared across tabs) */}
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

      {/* Tab selector */}
      <div className="flex gap-1 mb-8 bg-gray-900 rounded-lg p-1 border border-gray-800">
        <button
          onClick={() => setActiveTab("kyc")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
            activeTab === "kyc"
              ? "bg-violet-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          KYC SBT
        </button>
        <button
          onClick={() => setActiveTab("zktls")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
            activeTab === "zktls"
              ? "bg-violet-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          zkTLS Attestation
        </button>
      </div>

      {/* KYC SBT Tab */}
      {activeTab === "kyc" && (
        <>
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

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Step 3: Mint Credential</h2>
            {identity ? (
              <button
                onClick={() => {
                  if (isApproved || CONTRACTS.kycSBT === "0x0000000000000000000000000000000000000000") {
                    if (!kycInfo) {
                      const demoKyc: KycInfo = {
                        ensName: "demo.hsk",
                        level: 3,
                        status: 1,
                        createTime: BigInt(Math.floor(Date.now() / 1000)),
                      };
                      const slots = packKycSlots(demoKyc, 344n, 1n);
                      const credentialHash = computeCredentialHash(identity.commitment, slots);
                      const credential: Credential = {
                        id: `kyc-demo-${Date.now()}`,
                        type: CredentialType.KYC_SBT,
                        identityCommitment: identity.commitment,
                        credentialHash,
                        slots,
                        createdAt: Date.now(),
                      };
                      const currentTree = tree || new CredentialTree();
                      persistCredential(credential, currentTree);
                      setStatus("Demo credential created! (PREMIUM tier, HK jurisdiction)");
                    } else {
                      handleIssueCredential();
                    }
                  }
                }}
                disabled={isProcessing}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
              >
                {isProcessing ? "Processing..." : "Mint KYC Credential"}
              </button>
            ) : (
              <p className="text-sm text-gray-500">Create an identity first.</p>
            )}
          </section>
        </>
      )}

      {/* zkTLS Attestation Tab */}
      {activeTab === "zktls" && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Step 2: Attestation Source</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-lg">
                  GH
                </div>
                <div>
                  <p className="text-sm font-medium">GitHub Account Age</p>
                  <p className="text-xs text-gray-500">via Reclaim Protocol (zkTLS)</p>
                </div>
                <span className="ml-auto text-xs px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full">
                  Demo
                </span>
              </div>
              <div className="border-t border-gray-800 pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Provider</span>
                  <span>github-account-age</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Score Band</span>
                  <span>3 (account age &gt; 2 years)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Account Created</span>
                  <span>2019</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Jurisdiction</span>
                  <span>Global (0)</span>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                In production, Reclaim Protocol fetches a signed attestation from the data provider.
                This demo uses simulated attestation data.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Step 3: Mint Credential</h2>
            {identity ? (
              <button
                onClick={handleIssueZktls}
                disabled={isProcessing}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
              >
                {isProcessing ? "Processing..." : "Mint zkTLS Credential"}
              </button>
            ) : (
              <p className="text-sm text-gray-500">Create an identity first.</p>
            )}
          </section>
        </>
      )}

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
