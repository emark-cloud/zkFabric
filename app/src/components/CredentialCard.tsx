"use client";

import { type Credential, CredentialType } from "@/lib/fabric";

const TYPE_LABELS: Record<number, string> = {
  [CredentialType.KYC_SBT]: "KYC SBT",
  [CredentialType.ZKTLS]: "zkTLS",
  [CredentialType.ON_CHAIN]: "On-Chain",
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
  const isActive = credential.slots[2] === 1n;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-violet-400 uppercase tracking-wider">
            {typeLabel}
          </span>
          <h3 className="text-sm font-semibold mt-1">
            {credential.id}
          </h3>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isActive
              ? "bg-green-900/50 text-green-400"
              : "bg-red-900/50 text-red-400"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        {credential.slots.map((slot, i) => (
          <div key={i} className="flex justify-between">
            <span>{SLOT_LABELS[i]}</span>
            <span className="font-mono text-gray-400">
              {slot.toString().length > 12
                ? slot.toString().slice(0, 6) + "..." + slot.toString().slice(-4)
                : slot.toString()}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600 font-mono truncate">
        Hash: {credential.credentialHash.toString().slice(0, 20)}...
      </div>
    </div>
  );
}
