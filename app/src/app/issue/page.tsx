"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, KYC_SBT_ABI, KYC_ADAPTER_ABI, ZKTLS_ADAPTER_ABI, REGISTRY_ABI } from "@/lib/contracts";
import {
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
  loadMnemonic,
  loadOrCreateMnemonicIdentity,
  restoreFromMnemonic,
  syncTreeFromIndexer,
  type Identity,
  type Credential,
  type KycInfo,
  type ZKTLSAttestation,
} from "@/lib/fabric";
import { CredentialCard } from "@/components/CredentialCard";

type Tab = "kyc" | "zktls";

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-600/20 text-violet-400 text-xs font-heading mr-2">
      {n}
    </span>
  );
}

export default function IssuePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("kyc");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [tree, setTree] = useState<CredentialTree | null>(null);
  const [leafIndices, setLeafIndices] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  // Backup modal — non-null when a fresh mnemonic was just generated and the
  // user must acknowledge they've written it down.
  const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null);
  // Whether the user already has a stored mnemonic (controls the "View backup" affordance).
  const [hasMnemonic, setHasMnemonic] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");

  useEffect(() => {
    const id = loadIdentity();
    if (id) setIdentity(id);
    setCredentials(loadCredentials());
    setLeafIndices(loadLeafIndices());
    setHasMnemonic(loadMnemonic() !== null);

    // Source of truth for the credential tree is the indexer (replays the
    // on-chain CredentialRegistered event log). Local cache is only a fallback.
    let cancelled = false;
    syncTreeFromIndexer()
      .then((t) => {
        if (!cancelled) setTree(t);
      })
      .catch(() => {
        if (!cancelled) setTree(loadTree() || new CredentialTree());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: kycData } = useReadContract({
    address: CONTRACTS.kycSBT,
    abi: KYC_SBT_ABI,
    functionName: "getKycInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address && CONTRACTS.kycSBT !== "0x0000000000000000000000000000000000000000" },
  });

  const { writeContract: ingestOnChain, data: ingestTxHash } = useWriteContract();
  const { writeContract: registerHash, data: registerTxHash } = useWriteContract();
  const { isSuccess: ingestConfirmed } = useWaitForTransactionReceipt({ hash: ingestTxHash });
  const { isSuccess: registerConfirmed } = useWaitForTransactionReceipt({ hash: registerTxHash });

  const { writeContract: registerZktlsHash, data: zktlsRegisterTxHash } = useWriteContract();
  const { isSuccess: zktlsRegisterConfirmed } = useWaitForTransactionReceipt({ hash: zktlsRegisterTxHash });

  // Update Merkle root on-chain
  const { writeContract: updateRoot, data: updateRootTxHash } = useWriteContract();
  const { isSuccess: rootUpdated } = useWaitForTransactionReceipt({ hash: updateRootTxHash });

  // Set KYC on MockKycSBT
  const { writeContract: setKyc, data: setKycTxHash } = useWriteContract();
  const { isSuccess: setKycConfirmed } = useWaitForTransactionReceipt({ hash: setKycTxHash });

  const kycInfo: KycInfo | null = kycData
    ? {
        ensName: (kycData as any)[0] as string,
        level: Number((kycData as any)[1]),
        status: Number((kycData as any)[2]),
        createTime: BigInt((kycData as any)[3]),
      }
    : null;

  const isApproved = kycInfo && kycInfo.status === 1 && kycInfo.level >= 1;

  const handleCreateIdentity = useCallback(() => {
    // Recoverable identity: derive from a BIP39 12-word mnemonic so the user
    // can rebuild their wallet on any device. The mnemonic is shown ONCE in a
    // modal that requires acknowledgement before continuing.
    const { identity: id, mnemonic, isNew } = loadOrCreateMnemonicIdentity();
    setIdentity(id);
    setHasMnemonic(true);
    if (isNew) {
      setPendingMnemonic(mnemonic);
      setStatus("Identity created — back up your recovery phrase before continuing.");
    } else {
      setStatus("Identity loaded. Commitment: " + id.commitment.toString().slice(0, 20) + "...");
    }
  }, []);

  const handleRestore = useCallback(() => {
    try {
      const id = restoreFromMnemonic(restoreInput);
      setIdentity(id);
      setHasMnemonic(true);
      setShowRestore(false);
      setRestoreInput("");
      setStatus("Identity restored from recovery phrase.");
    } catch (err: any) {
      setStatus("Restore failed: " + err.message);
    }
  }, [restoreInput]);

  const handleViewBackup = useCallback(() => {
    const m = loadMnemonic();
    if (m) setPendingMnemonic(m);
  }, []);

  const persistCredential = useCallback(
    (credential: Credential, currentTree: CredentialTree) => {
      const leafIndex = currentTree.addCredential(credential.credentialHash);
      const newLeafIndices = new Map(leafIndices);

      // Remove old credential of the same type so we don't get duplicates
      const oldCred = credentials.find((c) => c.type === credential.type);
      if (oldCred) {
        newLeafIndices.delete(oldCred.id);
      }

      newLeafIndices.set(credential.id, leafIndex);
      const newCredentials = [
        ...credentials.filter((c) => c.type !== credential.type),
        credential,
      ];
      setCredentials(newCredentials);
      setTree(currentTree);
      setLeafIndices(newLeafIndices);
      saveCredentials(newCredentials);
      saveTree(currentTree);
      saveLeafIndices(newLeafIndices);

      // Update Merkle root on-chain so proofs verify
      const root = currentTree.getRoot();
      updateRoot({
        address: CONTRACTS.registry,
        abi: REGISTRY_ABI,
        functionName: "updateRoot",
        args: [root],
      });

      return newCredentials;
    },
    [credentials, leafIndices, updateRoot]
  );

  const handleIssueCredential = useCallback(async () => {
    if (!identity || !kycInfo || !tree) return;
    setIsProcessing(true);
    setStatus("Packing credential data...");

    try {
      const slots = packKycSlots(kycInfo, 344n, 1n);
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
      setStatus("Credential created! Updating Merkle root on-chain — please confirm the transaction...");
    } catch (err: any) {
      setStatus("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [identity, kycInfo, tree, address, ingestOnChain, persistCredential]);

  const handleIssueZktls = useCallback(() => {
    if (!identity || !tree) return;
    setIsProcessing(true);
    setStatus("Creating zkTLS attestation credential...");

    try {
      const attestation: ZKTLSAttestation = {
        provider: "github-account-age",
        primaryAttribute: 3n,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        jurisdictionCode: 0n,
        auxiliaryData1: 2019n,
        auxiliaryData2: 0n,
      };

      const slots = packZktlsSlots(attestation, 2n);
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
      setStatus("zkTLS credential created! Updating Merkle root on-chain — please confirm the transaction...");
    } catch (err: any) {
      setStatus("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [identity, tree, persistCredential, registerZktlsHash]);

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
    if (registerConfirmed) setStatus("Credential fully registered on-chain!");
  }, [registerConfirmed]);

  useEffect(() => {
    if (zktlsRegisterConfirmed) setStatus("zkTLS credential registered on-chain!");
  }, [zktlsRegisterConfirmed]);

  useEffect(() => {
    if (rootUpdated) setStatus("Merkle root updated on-chain! You can now generate proofs on the Prove page.");
  }, [rootUpdated]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-[#3f3f46]">
        Connect your wallet to issue credentials.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold font-heading mb-8 animate-fade-in-up">Issue Credential</h1>

      {/* Step 1: Identity */}
      <section className="mb-8 animate-fade-in-up stagger-1">
        <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa]">
          <StepBadge n={1} />Identity
        </h2>
        {identity ? (
          <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-[#71717a]">Identity commitment:</p>
              <p className="font-heading text-sm text-violet-400 break-all">
                {identity.commitment.toString()}
              </p>
            </div>
            {hasMnemonic && (
              <button
                onClick={handleViewBackup}
                className="text-xs font-heading uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                View recovery phrase →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleCreateIdentity}
              className="px-6 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 rounded-lg font-heading uppercase tracking-wider text-sm font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.25)]"
            >
              Create Identity
            </button>
            <button
              onClick={() => setShowRestore((s) => !s)}
              className="ml-3 text-xs font-heading uppercase tracking-wider text-[#71717a] hover:text-cyan-400 transition-colors"
            >
              Restore from recovery phrase
            </button>
            {showRestore && (
              <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-lg p-4 space-y-3">
                <p className="text-xs text-[#71717a]">
                  Paste your 12-word recovery phrase to restore your zkFabric identity.
                </p>
                <textarea
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                  rows={3}
                  className="w-full bg-[#111218] border border-[#1a1b23] rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-violet-500/50"
                  placeholder="word1 word2 word3 ..."
                />
                <button
                  onClick={handleRestore}
                  disabled={!restoreInput.trim()}
                  className="px-4 py-1.5 text-xs bg-violet-600/20 border border-violet-500/30 text-violet-400 rounded-lg font-heading uppercase tracking-wider disabled:opacity-40"
                >
                  Restore
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recovery phrase backup modal */}
      {pendingMnemonic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up">
          <div className="max-w-lg w-full mx-4 bg-[#0a0b0d] border border-violet-500/30 rounded-xl p-6 shadow-[0_0_40px_rgba(139,92,246,0.2)]">
            <h3 className="text-lg font-heading uppercase tracking-wider text-violet-400 mb-2">
              Recovery Phrase
            </h3>
            <p className="text-sm text-[#a1a1aa] mb-4">
              Write these 12 words down and keep them safe. Anyone with this phrase
              can restore your zkFabric identity. We never store it on a server —
              if you lose it and clear this browser, your credentials are gone.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {pendingMnemonic.split(" ").map((w, i) => (
                <div
                  key={i}
                  className="bg-[#111218] border border-[#1a1b23] rounded px-2 py-2 text-sm font-mono"
                >
                  <span className="text-[#3f3f46] mr-1">{i + 1}.</span>
                  <span className="text-cyan-400">{w}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(pendingMnemonic).catch(() => {
                    const ta = document.createElement("textarea");
                    ta.value = pendingMnemonic;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                  });
                }}
                className="px-4 py-2 text-xs font-heading uppercase tracking-wider bg-[#111218] border border-[#1a1b23] rounded-lg text-[#a1a1aa] hover:border-cyan-500/30 hover:text-cyan-400 transition-all"
              >
                Copy
              </button>
              <button
                onClick={() => setPendingMnemonic(null)}
                className="ml-auto px-6 py-2 text-xs font-heading uppercase tracking-wider bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 rounded-lg shadow-[0_0_15px_rgba(139,92,246,0.25)] transition-all"
              >
                I've Written It Down
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-8 mb-8 border-b border-[#1a1b23] animate-fade-in-up stagger-2">
        {(["kyc", "zktls"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative pb-3 text-sm font-heading uppercase tracking-wider transition-colors ${
              activeTab === tab ? "text-white" : "text-[#3f3f46] hover:text-[#71717a]"
            }`}
          >
            {tab === "kyc" ? "KYC SBT" : "zkTLS Attestation"}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* KYC SBT Tab */}
      {activeTab === "kyc" && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa]">
              <StepBadge n={2} />KYC Status
            </h2>
            {kycInfo && isApproved ? (
              <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#71717a]">ENS Name</span>
                  <span>{kycInfo.ensName || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Level</span>
                  <span>{["NONE", "BASIC", "ADVANCED", "PREMIUM", "ULTIMATE"][kycInfo.level]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Status</span>
                  <span className="text-green-400">
                    {["NONE", "APPROVED", "REVOKED"][kycInfo.status]}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-lg p-4 space-y-3">
                <p className="text-sm text-yellow-400">
                  No KYC found for your address. Register on the MockKycSBT contract to continue.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { label: "BASIC", level: 1 },
                    { label: "ADVANCED", level: 2 },
                    { label: "PREMIUM", level: 3 },
                    { label: "ULTIMATE", level: 4 },
                  ] as const).map(({ label, level }) => (
                    <button
                      key={level}
                      onClick={() => {
                        if (!address) return;
                        setKyc({
                          address: CONTRACTS.kycSBT,
                          abi: KYC_SBT_ABI,
                          functionName: "setKycInfo",
                          args: [address, `${address.slice(0, 6)}.hsk`, level, 1],
                        });
                        setStatus(`Setting KYC to ${label}...`);
                      }}
                      className={`px-3 py-1.5 text-xs font-heading uppercase tracking-wider rounded-lg border transition-all duration-200 ${
                        level === 3
                          ? "bg-violet-600/20 border-violet-500/30 text-violet-400 hover:bg-violet-600/30"
                          : "bg-[#111218] border-[#1a1b23] text-[#a1a1aa] hover:border-[#2d2e3a]"
                      }`}
                    >
                      {label}
                      {level === 3 && " (Recommended)"}
                    </button>
                  ))}
                </div>
                {setKycConfirmed && (
                  <p className="text-sm text-green-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-dot-pulse inline-block" />
                    KYC registered! Refresh the page to see your status.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa]">
              <StepBadge n={3} />Mint Credential
            </h2>
            {identity ? (
              <button
                onClick={() => {
                  const noKyc = !kycInfo || (kycInfo.level === 0 && kycInfo.status === 0);
                  if (isApproved || CONTRACTS.kycSBT === "0x0000000000000000000000000000000000000000" || noKyc) {
                    if (!kycInfo || noKyc) {
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
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg font-heading uppercase tracking-wider text-sm font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.25)]"
              >
                {isProcessing ? "Processing..." : "Mint KYC Credential"}
              </button>
            ) : (
              <p className="text-sm text-[#3f3f46]">Create an identity first.</p>
            )}
          </section>
        </>
      )}

      {/* zkTLS Attestation Tab */}
      {activeTab === "zktls" && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa]">
              <StepBadge n={2} />Attestation Source
            </h2>
            <div className="bg-[#0a0b0d] border border-[#1a1b23] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#111218] border border-[#1a1b23] rounded-lg flex items-center justify-center text-sm font-heading text-cyan-400">
                  GH
                </div>
                <div>
                  <p className="text-sm font-medium">GitHub Account Age</p>
                  <p className="text-xs text-[#71717a]">via Reclaim Protocol (zkTLS)</p>
                </div>
                <span className="ml-auto text-[10px] font-heading uppercase tracking-widest px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-full border border-yellow-500/20">
                  Demo
                </span>
              </div>
              <div className="border-t border-[#1a1b23] pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Provider</span>
                  <span className="font-heading text-cyan-400">github-account-age</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Score Band</span>
                  <span>3 (account age &gt; 2 years)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Account Created</span>
                  <span>2019</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Jurisdiction</span>
                  <span>Global (0)</span>
                </div>
              </div>
              <p className="text-xs text-[#3f3f46]">
                In production, Reclaim Protocol fetches a signed attestation from the data provider.
                This demo uses simulated attestation data.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-[#a1a1aa]">
              <StepBadge n={3} />Mint Credential
            </h2>
            {identity ? (
              <button
                onClick={handleIssueZktls}
                disabled={isProcessing}
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg font-heading uppercase tracking-wider text-sm font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.25)]"
              >
                {isProcessing ? "Processing..." : "Mint zkTLS Credential"}
              </button>
            ) : (
              <p className="text-sm text-[#3f3f46]">Create an identity first.</p>
            )}
          </section>
        </>
      )}

      {/* Status */}
      {status && (
        <div className="mb-8 bg-[#0a0b0d]/50 border border-[#1a1b23] border-l-2 border-l-violet-500 rounded-lg p-3 text-sm text-[#a1a1aa] animate-slide-down">
          {status}
        </div>
      )}

      {/* Credentials */}
      {credentials.length > 0 && (
        <section className="animate-fade-in-up stagger-3">
          <h2 className="text-lg font-semibold font-heading mb-3 text-[#a1a1aa]">Your Credentials</h2>
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
