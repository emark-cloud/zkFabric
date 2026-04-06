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

    // Build predicates from non-NONE slots
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

  // Quick presets
  const applyPreset = (preset: "kyc-basic" | "kyc-premium" | "hk-only") => {
    const updated = Array.from({ length: 8 }, () => ({
      op: PredicateType.NONE,
      value: "0",
      set: "",
    }));

    if (preset === "kyc-basic") {
      updated[0] = { op: PredicateType.EQUALS, value: "1", set: "" }; // KYC type
      updated[2] = { op: PredicateType.EQUALS, value: "1", set: "" }; // active
    } else if (preset === "kyc-premium") {
      updated[0] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[1] = { op: PredicateType.GREATER_EQUAL, value: "3", set: "" }; // tier >= 3
      updated[2] = { op: PredicateType.EQUALS, value: "1", set: "" };
    } else if (preset === "hk-only") {
      updated[0] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[2] = { op: PredicateType.EQUALS, value: "1", set: "" };
      updated[4] = { op: PredicateType.EQUALS, value: "344", set: "" }; // HK
    }

    setSlots(updated);

    const predicates: Predicate[] = updated
      .map((s, i) => {
        if (s.op === PredicateType.NONE) return null;
        return { slot: i, op: s.op, value: BigInt(s.value || "0") } as Predicate;
      })
      .filter(Boolean) as Predicate[];
    onPredicatesChange(predicates);
  };

  return (
    <div>
      {/* Presets */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => applyPreset("kyc-basic")}
          className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
        >
          KYC Basic
        </button>
        <button
          onClick={() => applyPreset("kyc-premium")}
          className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
        >
          KYC Premium
        </button>
        <button
          onClick={() => applyPreset("hk-only")}
          className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
        >
          HK Jurisdiction
        </button>
      </div>

      {/* Slot editors */}
      <div className="space-y-3">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              slot.op !== PredicateType.NONE
                ? "border-violet-800 bg-violet-900/10"
                : "border-gray-800 bg-gray-900/50"
            }`}
          >
            <span className="text-xs text-gray-500 w-36 shrink-0">
              [{i}] {SLOT_LABELS[i]}
            </span>

            <select
              value={slot.op}
              onChange={(e) => updateSlot(i, "op", e.target.value)}
              className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700"
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
                className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700 w-32 font-mono"
              />
            )}

            {slot.op === PredicateType.IN_SET && (
              <input
                type="text"
                value={slot.set}
                onChange={(e) => updateSlot(i, "set", e.target.value)}
                placeholder="1,2,3,4 (max 4)"
                className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700 flex-1 font-mono"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
