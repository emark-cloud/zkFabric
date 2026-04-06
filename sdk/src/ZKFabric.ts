import {
  Predicate,
  PredicateType,
  ProofRequest,
  ZKProof,
  CircuitArtifacts,
} from "./types";
import { verifyProof } from "./prover";

/**
 * ZKFabric is the dApp-facing SDK for creating proof requirements
 * and verifying proofs (both off-chain and on-chain).
 */
export class ZKFabric {
  private artifacts: CircuitArtifacts;

  constructor(artifacts: CircuitArtifacts) {
    this.artifacts = artifacts;
  }

  /**
   * Create a proof request with predicates.
   * This is a convenience builder for dApps to specify their requirements.
   */
  createProofRequest(scope: bigint, predicates: Predicate[] = []): ProofRequest {
    // Validate predicates
    for (const pred of predicates) {
      if (pred.slot < 0 || pred.slot >= 8) {
        throw new Error(`Invalid slot index: ${pred.slot}`);
      }
      if (pred.op === PredicateType.IN_SET) {
        if (!pred.set || pred.set.length === 0) {
          throw new Error(`IN_SET predicate on slot ${pred.slot} requires a non-empty set`);
        }
        if (pred.set.length > 4) {
          throw new Error(`IN_SET predicate on slot ${pred.slot} exceeds max set size of 4`);
        }
      }
    }

    return { scope, predicates };
  }

  /**
   * Verify a proof off-chain using the verification key.
   * Useful for testing or server-side verification.
   */
  async verifyProofOffChain(proof: ZKProof): Promise<boolean> {
    return verifyProof(proof, this.artifacts);
  }

  /**
   * Check if a proof's public signals satisfy specific predicate requirements.
   * This is a client-side check — the circuit enforces this, but dApps
   * can pre-validate before submitting on-chain.
   */
  validatePublicSignals(proof: ZKProof, request: ProofRequest): boolean {
    const signals = proof.publicSignals;

    // Signal[0] = allPredicatesPass must be 1
    if (signals[0] !== 1n) return false;

    // Signal[3] = scope must match
    if (signals[3] !== request.scope) return false;

    // Verify predicate encoding matches what was requested
    for (const pred of request.predicates) {
      const typeSignal = signals[4 + pred.slot];
      if (typeSignal !== BigInt(pred.op)) return false;

      const valueSignal = signals[12 + pred.slot];
      if (valueSignal !== pred.value) return false;

      if (pred.op === PredicateType.IN_SET && pred.set) {
        for (let i = 0; i < pred.set.length; i++) {
          const setSignal = signals[20 + pred.slot * 4 + i];
          if (setSignal !== pred.set[i]) return false;
        }
      }
    }

    return true;
  }
}
