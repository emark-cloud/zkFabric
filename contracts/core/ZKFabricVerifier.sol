// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Groth16Verifier.sol";
import "../interfaces/IZKFabric.sol";

/// @title ZKFabricVerifier — On-chain ZK proof verification with nullifier tracking
/// @notice Wraps the auto-generated Groth16Verifier with nullifier registry and root validation.
///
/// Public signals layout (52 total, matching the circuit):
///   [0]     allPredicatesPass (output, always 1 for valid proofs)
///   [1]     merkleRoot
///   [2]     nullifierHash
///   [3]     scope
///   [4-11]  predicateTypes[8]
///   [12-19] predicateValues[8]
///   [20-51] predicateSets[8][4] (flattened)
contract ZKFabricVerifier is IZKFabric {
    Groth16Verifier public immutable groth16Verifier;
    address public registry;
    address public revocationRegistry;
    address public owner;

    /// @notice Nullifier => used. Prevents replay of proofs.
    mapping(uint256 => bool) public nullifiers;

    modifier onlyOwner() {
        require(msg.sender == owner, "ZKFabricVerifier: not owner");
        _;
    }

    constructor(address _groth16Verifier) {
        groth16Verifier = Groth16Verifier(_groth16Verifier);
        owner = msg.sender;
    }

    /// @notice Set the registry address (for root validation).
    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
    }

    /// @notice Set the revocation registry address. When set, the verifier rejects any
    ///         proof whose merkleRoot or nullifier has been marked revoked.
    function setRevocationRegistry(address _revocationRegistry) external onlyOwner {
        revocationRegistry = _revocationRegistry;
    }

    /// @inheritdoc IZKFabric
    function verifyAndRecord(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals,
        uint256 scope
    ) external override returns (bool valid) {
        require(publicSignals.length == 52, "ZKFabricVerifier: invalid signal count");

        // Extract key signals
        uint256 allPass = publicSignals[0];
        uint256 merkleRoot = publicSignals[1];
        uint256 nullifierHash = publicSignals[2];
        uint256 proofScope = publicSignals[3];

        // Validate scope matches
        require(proofScope == scope, "ZKFabricVerifier: scope mismatch");

        // Validate all predicates passed (circuit output)
        require(allPass == 1, "ZKFabricVerifier: predicates not satisfied");

        // Check nullifier not already used
        require(!nullifiers[nullifierHash], "ZKFabricVerifier: nullifier already used");

        // Check Merkle root is valid (if registry is set)
        if (registry != address(0)) {
            require(
                IZKFabricRegistry(registry).isValidRoot(merkleRoot),
                "ZKFabricVerifier: invalid merkle root"
            );
        }

        // Check revocation status (if revocation registry is set)
        if (revocationRegistry != address(0)) {
            require(
                !IRevocationRegistry(revocationRegistry).isRootRevoked(merkleRoot),
                "ZKFabricVerifier: root revoked"
            );
            require(
                !IRevocationRegistry(revocationRegistry).isNullifierRevoked(nullifierHash),
                "ZKFabricVerifier: nullifier revoked"
            );
        }

        // Verify the Groth16 proof
        // Convert proof array to the format expected by the auto-generated verifier
        uint[2] memory pA = [proof[0], proof[1]];
        uint[2][2] memory pB = [[proof[2], proof[3]], [proof[4], proof[5]]];
        uint[2] memory pC = [proof[6], proof[7]];

        // Copy public signals to fixed-size array
        uint[52] memory pubSignals;
        for (uint256 i = 0; i < 52; i++) {
            pubSignals[i] = publicSignals[i];
        }

        bool proofValid = groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
        require(proofValid, "ZKFabricVerifier: invalid proof");

        // Record nullifier
        nullifiers[nullifierHash] = true;

        emit ProofVerified(scope, nullifierHash, msg.sender);
        emit NullifierRecorded(nullifierHash);

        return true;
    }

    /// @inheritdoc IZKFabric
    function isNullifierUsed(uint256 nullifierHash) external view override returns (bool) {
        return nullifiers[nullifierHash];
    }

    /// @inheritdoc IZKFabric
    function isValidRoot(uint256 root) external view override returns (bool) {
        if (registry == address(0)) return true;
        return IZKFabricRegistry(registry).isValidRoot(root);
    }
}

/// @dev Minimal interface for registry root validation (avoids circular import)
interface IZKFabricRegistry {
    function isValidRoot(uint256 root) external view returns (bool);
}

/// @dev Minimal interface for revocation lookups (avoids circular import)
interface IRevocationRegistry {
    function isRootRevoked(uint256 root) external view returns (bool);
    function isNullifierRevoked(uint256 nullifier) external view returns (bool);
}
