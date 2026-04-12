"use client";

import { type Credential, CredentialType } from "@/lib/fabric";

const TYPE_LABELS: Record<number, string> = {
  [CredentialType.KYC_SBT]: "KYC SBT",
  [CredentialType.ZKTLS]: "zkTLS",
  [CredentialType.ON_CHAIN]: "On-Chain",
};

const FRIENDLY_NAMES: Record<number, string> = {
  [CredentialType.KYC_SBT]: "KYC Credential",
  [CredentialType.ZKTLS]: "zkTLS Credential",
  [CredentialType.ON_CHAIN]: "On-Chain Credential",
};

const BORDER_COLORS: Record<number, string> = {
  [CredentialType.KYC_SBT]: "border-t-violet-500",
  [CredentialType.ZKTLS]: "border-t-cyan-500",
  [CredentialType.ON_CHAIN]: "border-t-green-500",
};

const LEVEL_LABELS: Record<number, string> = {
  0: "NONE",
  1: "BASIC",
  2: "ADVANCED",
  3: "PREMIUM",
  4: "ULTIMATE",
};

const JURISDICTION_LABELS: Record<number, string> = {
  0: "Global",
  344: "Hong Kong",
  702: "Singapore",
  392: "Japan",
};

function formatSlotValue(index: number, value: bigint): { label: string; display: string } | null {
  const num = Number(value);

  switch (index) {
    case 0: // Credential Type
      return { label: "Type", display: TYPE_LABELS[num] || `Type ${num}` };
    case 1: // Primary Attribute (KYC Level)
      return { label: "KYC Level", display: LEVEL_LABELS[num] || `Level ${num}` };
    case 2: // Status
      return { label: "Status", display: num === 1 ? "Active" : "Inactive" };
    case 3: // Issuance Timestamp
      if (value === 0n) return null;
      return {
        label: "Issued",
        display: new Date(num * 1000).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      };
    case 4: // Jurisdiction
      return { label: "Jurisdiction", display: JURISDICTION_LABELS[num] || `Code ${num}` };
    case 5: // Issuer ID
      if (value === 0n) return null;
      return { label: "Issuer", display: num.toString() };
    case 6: // Aux 1
    case 7: // Aux 2
      if (value === 0n) return null;
      return { label: `Data ${index - 5}`, display: num.toString() };
    default:
      return null;
  }
}

export function CredentialCard({ credential }: { credential: Credential }) {
  const typeLabel = TYPE_LABELS[credential.type] || `Type ${credential.type}`;
  const friendlyName = FRIENDLY_NAMES[credential.type] || "Credential";
  const borderColor = BORDER_COLORS[credential.type] || "border-t-gray-500";
  const isActive = credential.slots[2] === 1n;

  const issueDate = new Date(credential.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedSlots = credential.slots
    .map((slot, i) => formatSlotValue(i, slot))
    .filter(Boolean) as { label: string; display: string }[];

  return (
    <div className={`bg-[#0a0b0d] border border-[#1a1b23] border-t-2 ${borderColor} rounded-xl p-5 hover:-translate-y-0.5 hover:border-[#2d2e3a] transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-heading text-violet-400 uppercase tracking-widest">
            {typeLabel}
          </span>
          <h3 className="text-sm font-semibold mt-1">
            {friendlyName}
          </h3>
          <p className="text-[10px] text-[#3f3f46] mt-0.5">Issued {issueDate}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={`w-2 h-2 rounded-full inline-block ${
              isActive ? "bg-green-400 animate-dot-pulse" : "bg-red-400"
            }`}
          />
          <span className={isActive ? "text-green-400" : "text-red-400"}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </span>
      </div>

      <div className="space-y-1 text-xs text-[#71717a]">
        {formattedSlots.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="font-heading text-[10px]">{item.label}</span>
            <span className="font-heading text-[#a1a1aa]">{item.display}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#1a1b23] text-xs font-heading truncate">
        <span className="text-[#3f3f46]">Fingerprint: </span>
        <span className="gradient-text">{credential.credentialHash.toString().slice(0, 20)}...</span>
      </div>
    </div>
  );
}
