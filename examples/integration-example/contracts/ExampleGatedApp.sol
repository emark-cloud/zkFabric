// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ExampleGatedApp — minimal zkFabric-gated consumer
/// @notice Emits `GatedAction` only if the caller presents a valid Groth16
///         proof from zkFabric's selective-disclosure circuit that satisfies
///         the predicate bound into the user's credential commitment.
///
///         The predicate itself is chosen client-side — this contract doesn't
///         care what you proved, only that `verifyAndRecord` accepted it.
///         Nullifier uniqueness is enforced by zkFabric per this contract's
///         SCOPE, so each identity can call `doGatedThing` at most once.
interface IZKFabric {
    function verifyAndRecord(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals,
        uint256 scope
    ) external returns (bool);
}

contract ExampleGatedApp {
    IZKFabric public immutable zkFabric;

    uint256 private constant BN128_FIELD_PRIME =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @notice Per-dApp scope. Unique nullifiers per identity-per-scope.
    uint256 public constant SCOPE =
        uint256(keccak256(abi.encodePacked("zkfabric-example-v1"))) % BN128_FIELD_PRIME;

    event GatedAction(address indexed caller, uint256 indexed nullifier);

    constructor(address _zkFabric) {
        zkFabric = IZKFabric(_zkFabric);
    }

    function doGatedThing(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external {
        zkFabric.verifyAndRecord(proof, publicSignals, SCOPE);
        emit GatedAction(msg.sender, publicSignals[2]);
    }
}
