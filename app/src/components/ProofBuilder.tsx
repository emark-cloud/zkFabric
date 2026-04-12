"use client";

import { useState, useEffect } from "react";
import { PredicateType, type Predicate } from "@/lib/fabric";

// ── Human-friendly proof configuration ──────────────────────────────────
// Each "question" maps to one or more predicate slots under the hood.
// Users pick from plain-language options; we convert to circuit predicates.

const KYC_LEVELS = [
  { label: "Any (BASIC+)", value: 1 },
  { label: "ADVANCED+", value: 2 },
  { label: "PREMIUM+", value: 3 },
  { label: "ULTIMATE only", value: 4 },
] as const;

const JURISDICTIONS = [
  { label: "Any", value: 0 },
  { label: "Hong Kong (344)", value: 344 },
  { label: "Singapore (702)", value: 702 },
  { label: "Japan (392)", value: 392 },
] as const;

const STATUS_OPTIONS = [
  { label: "Active only", value: 1 },
  { label: "Any", value: 0 },
] as const;

// ── Preset quick-picks ──────────────────────────────────────────────────

const PRESETS = [
  {
    key: "kyc-premium",
    label: "Gated Vault",
    description: "PREMIUM+ KYC, active status",
    config: { minLevel: 3, jurisdiction: 0, status: 1 },
  },
  {
    key: "kyc-basic",
    label: "Basic Access",
    description: "Any KYC level, active status",
    config: { minLevel: 1, jurisdiction: 0, status: 1 },
  },
  {
    key: "hk-only",
    label: "HK Jurisdiction",
    description: "Any KYC level, Hong Kong only",
    config: { minLevel: 1, jurisdiction: 344, status: 1 },
  },
] as const;

interface Props {
  onPredicatesChange: (predicates: Predicate[]) => void;
}

interface UserConfig {
  minLevel: number;
  jurisdiction: number;
  status: number;
}

function configToPredicates(config: UserConfig): Predicate[] {
  const predicates: Predicate[] = [];

  // Slot 0: Credential type = KYC_SBT (1)
  predicates.push({ slot: 0, op: PredicateType.EQUALS, value: 1n });

  // Slot 1: KYC level >= minLevel
  if (config.minLevel > 0) {
    predicates.push({
      slot: 1,
      op: config.minLevel === 4 ? PredicateType.EQUALS : PredicateType.GREATER_EQUAL,
      value: BigInt(config.minLevel),
    });
  }

  // Slot 2: Status = active
  if (config.status === 1) {
    predicates.push({ slot: 2, op: PredicateType.EQUALS, value: 1n });
  }

  // Slot 4: Jurisdiction
  if (config.jurisdiction > 0) {
    predicates.push({
      slot: 4,
      op: PredicateType.EQUALS,
      value: BigInt(config.jurisdiction),
    });
  }

  return predicates;
}

export function ProofBuilder({ onPredicatesChange }: Props) {
  const [config, setConfig] = useState<UserConfig>({
    minLevel: 3,
    jurisdiction: 0,
    status: 1,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("kyc-premium");

  // Raw slot state for advanced mode
  const [slots, setSlots] = useState<
    { op: PredicateType; value: string; set: string }[]
  >(
    Array.from({ length: 8 }, () => ({
      op: PredicateType.NONE,
      value: "0",
      set: "",
    }))
  );

  const updateConfig = (partial: Partial<UserConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    setActivePreset("");
    onPredicatesChange(configToPredicates(updated));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setConfig(preset.config);
    setActivePreset(preset.key);
    onPredicatesChange(configToPredicates(preset.config));
  };

  // Initialize with default predicates on mount
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      onPredicatesChange(configToPredicates(config));
      setInitialized(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Advanced mode helpers ──────────────────────────────────────────────

  const SLOT_LABELS = [
    "Credential Type",
    "Primary Attribute",
    "Status Flag",
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

  const buildAdvancedPredicates = (updated: typeof slots) => {
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
    buildAdvancedPredicates(updated);
  };

  return (
    <div>
      {/* Preset quick-picks */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            onClick={() => applyPreset(preset)}
            className={`text-xs px-3 py-2 rounded-lg border transition-all duration-200 font-heading ${
              activePreset === preset.key
                ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
                : "border-[#1a1b23] bg-[#0a0b0d] text-[#a1a1aa] hover:border-violet-500/30 hover:bg-violet-500/5"
            }`}
          >
            <span className="block uppercase tracking-wider font-semibold">{preset.label}</span>
            <span className="block text-[10px] text-[#71717a] mt-0.5 normal-case tracking-normal">{preset.description}</span>
          </button>
        ))}
      </div>

      {/* Human-readable configuration */}
      {!showAdvanced && (
        <div className="space-y-4 bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-4">
          {/* Minimum KYC Level */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#e4e4e7]">Minimum KYC Level</p>
              <p className="text-[11px] text-[#3f3f46]">What tier must the user have?</p>
            </div>
            <select
              value={config.minLevel}
              onChange={(e) => updateConfig({ minLevel: Number(e.target.value) })}
              className="bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading transition-colors text-violet-400"
            >
              {KYC_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between gap-4 border-t border-[#1a1b23] pt-4">
            <div>
              <p className="text-sm text-[#e4e4e7]">Account Status</p>
              <p className="text-[11px] text-[#3f3f46]">Must the credential be active?</p>
            </div>
            <select
              value={config.status}
              onChange={(e) => updateConfig({ status: Number(e.target.value) })}
              className="bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading transition-colors text-violet-400"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Jurisdiction */}
          <div className="flex items-center justify-between gap-4 border-t border-[#1a1b23] pt-4">
            <div>
              <p className="text-sm text-[#e4e4e7]">Jurisdiction</p>
              <p className="text-[11px] text-[#3f3f46]">Restrict to a specific country?</p>
            </div>
            <select
              value={config.jurisdiction}
              onChange={(e) => updateConfig({ jurisdiction: Number(e.target.value) })}
              className="bg-[#050505] text-sm rounded px-3 py-2 border border-[#1a1b23] focus:border-violet-500/50 focus:outline-none font-heading transition-colors text-violet-400"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div className="border-t border-[#1a1b23] pt-4">
            <p className="text-[11px] text-[#3f3f46] font-heading uppercase tracking-wider mb-2">What you'll prove</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-1 bg-violet-500/10 text-violet-400 rounded-full border border-violet-500/20 font-heading">
                KYC {config.minLevel === 4 ? "= ULTIMATE" : `≥ ${["", "BASIC", "ADVANCED", "PREMIUM", "ULTIMATE"][config.minLevel]}`}
              </span>
              {config.status === 1 && (
                <span className="text-[10px] px-2 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20 font-heading">
                  Active
                </span>
              )}
              {config.jurisdiction > 0 && (
                <span className="text-[10px] px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 font-heading">
                  {JURISDICTIONS.find((j) => j.value === config.jurisdiction)?.label}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#3f3f46] mt-2">
              Your actual KYC tier, name, and wallet address remain hidden.
            </p>
          </div>
        </div>
      )}

      {/* Advanced mode toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-3 text-[10px] font-heading uppercase tracking-wider text-[#3f3f46] hover:text-[#71717a] transition-colors"
      >
        {showAdvanced ? "← Simple mode" : "Advanced: raw slot editor →"}
      </button>

      {/* Advanced: raw slot editors */}
      {showAdvanced && (
        <div className="mt-3 space-y-2">
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
      )}
    </div>
  );
}
