// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IZKFabric {
    /// @notice Verify a ZK proof and record the nullifier to prevent replay.
    /// @param proof Groth16 proof elements [a[0], a[1], b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]]
    /// @param publicSignals Public inputs to the circuit
    /// @param scope The dApp-specific scope identifier
    /// @return valid True if proof is valid, nullifier is fresh, and root is recognized
    function verifyAndRecord(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals,
        uint256 scope
    ) external returns (bool valid);

    /// @notice Check if a nullifier has already been used for a given scope.
    function isNullifierUsed(uint256 nullifierHash) external view returns (bool);

    /// @notice Check if a Merkle root is currently valid.
    function isValidRoot(uint256 root) external view returns (bool);

    event ProofVerified(uint256 indexed scope, uint256 indexed nullifierHash, address verifier);
    event NullifierRecorded(uint256 indexed nullifierHash);
}
