"use client";

import { type Credential, CredentialType } from "@/lib/fabric";

const TYPE_LABELS: Record<number, string> = {
  [CredentialType.KYC_SBT]: "KYC SBT",
  [CredentialType.ZKTLS]: "zkTLS",
  [CredentialType.ON_CHAIN]: "On-Chain",
};

const BORDER_COLORS: Record<number, string> = {
  [CredentialType.KYC_SBT]: "border-t-violet-500",
  [CredentialType.ZKTLS]: "border-t-cyan-500",
  [CredentialType.ON_CHAIN]: "border-t-green-500",
};

const SLOT_LABELS = [
  "Credential Type",
  "Primary Attribute",
  "Status",
  "Issuance Time",
  "Jurisdiction",
  "Issuer ID",
  "Aux 1",
  "Aux 2",
];

export function CredentialCard({ credential }: { credential: Credential }) {
  const typeLabel = TYPE_LABELS[credential.type] || `Type ${credential.type}`;
  const borderColor = BORDER_COLORS[credential.type] || "border-t-gray-500";
  const isActive = credential.slots[2] === 1n;

  return (
    <div className={`bg-[#0a0b0d] border border-[#1a1b23] border-t-2 ${borderColor} rounded-xl p-5 hover:-translate-y-0.5 hover:border-[#2d2e3a] transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-heading text-violet-400 uppercase tracking-widest">
            {typeLabel}
          </span>
          <h3 className="text-sm font-semibold mt-1">
            {credential.id}
          </h3>
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
        {credential.slots.map((slot, i) => (
          <div key={i} className="flex justify-between">
            <span className="font-heading text-[10px]">{SLOT_LABELS[i]}</span>
            <span className="font-heading text-[#a1a1aa]">
              {slot.toString().length > 12
                ? slot.toString().slice(0, 6) + "..." + slot.toString().slice(-4)
                : slot.toString()}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#1a1b23] text-xs font-heading truncate">
        <span className="text-[#3f3f46]">Hash: </span>
        <span className="gradient-text">{credential.credentialHash.toString().slice(0, 20)}...</span>
      </div>
    </div>
  );
}
