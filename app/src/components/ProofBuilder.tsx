"use client";

import { useState } from "react";
import { PredicateType, type Predicate } from "@/lib/fabric";

const SLOT_LABELS = [
  "Credential Type",
  "Primary Attribute (KYC Tier)",
  "Status (Active)",
  "Issuance Timestamp",
  "Jurisdiction Code",
  "Issuer Identifier",
  "Auxiliary 1",
  "Auxiliary 2",
];

const OP_LABELS: Record<number, string> = {
  [PredicateType.NONE]: "None (skip)",
  [PredicateType.EQUALS]: "Equals",
  [PredicateType.GREATER_EQUAL]: ">=",
  [PredicateType.LESS_THAN]: "<",
  [PredicateType.IN_SET]: "In Set",
};

const PRESETS = [
  { key: "kyc-basic", label: "B", title: "KYC Basic" },
  { key: "kyc-premium", label: "P", title: "KYC Premium" },
  { key: "hk-only", label: "HK", title: "HK Jurisdiction" },
] as const;

interface Props {
  onPredicatesChange: (predicates: Predicate[]) => void;
}

export function ProofBuilder({ onPredicatesChange }: Props) {
  const [slots, setSlots] = useState<
    { op: PredicateType; value: string; set: string }[]
  >(
    Array.from({ length: 8 }, () => ({
      op: PredicateType.NONE,
      value: "0",
      set: "",
    }))
  );

  const buildPredicates = (updated: typeof slots) => {
    const predicates: Predicate[] = updated
      .map((s, i) => {
        if (s.op === PredicateType.NONE) return null;
        const pred: Predicate = {
          slot: i,
          op: s.op,
          value: BigInt(s.value || "0"),
        };
        if (s.op === PredicateType.IN_SET && s.set) {
          pred.set = s.set
            .split(",")
            .map((v) => BigInt(v.trim()))
            .slice(0, 4);
        }
        return pred;
      })
      .filter(Boolean) as Predicate[];
    onPredicatesChange(predicates);
  };

  const updateSlot = (
    index: number,
    field: "op" | "value" | "set",
    val: string
  ) => {
    const updated = [...slots];
    if (field === "op") {
      updated[index] = { ...updated[index], op: Number(val) as PredicateType };
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setSlots(updated);
    buildPredicates(updated);
  };

  const applyPreset = (preset: string) => {
    const updated = Array.from({ length: 8 }, () => ({
      op: PredicateType.NONE,
      value: "0",
      set: "",
    }));

    if (preset === "kyc-basic") {
      updated[0] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[2] = { op: PredicateType.EQUALS, value: "1", set: "" };
    } else if (preset === "kyc-premium") {
      updated[0] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[1] = { op: PredicateType.GREATER_EQUAL, value: "3", set: "" };
      updated[2] = { op: PredicateType.EQUALS, value: "1", set: "" };
    } else if (preset === "hk-only") {
      updated[0] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[2] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[4] = { op: PredicateType.EQUALS, value: "344", set: "" };
    }

    setSlots(updated);
    buildPredicates(updated);
  };

  return (
    <div>
      {/* Presets */}
      <div className="flex gap-2 mb-4">
        {PRESETS.map(({ key, label, title }) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#0a0b0d] border border-[#1a1b23] hover:border-violet-500/30 hover:bg-violet-500/5 rounded-lg transition-all duration-200 font-heading uppercase tracking-wider"
          >
            <span className="text-violet-400">[{label}]</span>
            {title}
          </button>
        ))}
      </div>

      {/* Slot editors */}
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
              slot.op !== PredicateType.NONE
                ? "border-violet-500/30 bg-violet-500/5 glow-border"
                : "border-[#1a1b23] bg-[#0a0b0d]/50"
            }`}
          >
            <span className="text-[10px] font-heading uppercase tracking-wider text-[#71717a] w-36 shrink-0">
              [{i}] {SLOT_LABELS[i]}
            </span>

            <select
              value={slot.op}
              onChange={(e) => updateSlot(i, "op", e.target.value)}
              className="bg-[#050505] text-xs rounded px-2 py-1.5 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading transition-colors"
            >
              {Object.entries(OP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {slot.op !== PredicateType.NONE && slot.op !== PredicateType.IN_SET && (
              <input
                type="text"
                value={slot.value}
                onChange={(e) => updateSlot(i, "value", e.target.value)}
                placeholder="Value"
                className="bg-[#050505] text-xs rounded px-2 py-1.5 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none w-32 font-heading transition-colors"
              />
            )}

            {slot.op === PredicateType.IN_SET && (
              <input
                type="text"
                value={slot.set}
                onChange={(e) => updateSlot(i, "set", e.target.value)}
                placeholder="1,2,3,4 (max 4)"
                className="bg-[#050505] text-xs rounded px-2 py-1.5 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none flex-1 font-heading transition-colors"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
