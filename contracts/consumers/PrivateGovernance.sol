// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IZKFabric.sol";

/// @title PrivateGovernance — Anonymous voting with ZK proof of humanity
/// @notice Each verified user gets exactly one vote per proposal.
///         Nullifiers are scoped per-proposal, so the same identity can vote on
///         multiple proposals but only once per proposal. Votes are unlinkable
///         across proposals.
contract PrivateGovernance {
    IZKFabric public immutable zkFabric;

    struct Proposal {
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool exists;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalCreated(uint256 indexed proposalId, string description, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, uint8 choice, uint256 nullifierHash);

    constructor(address _zkFabric) {
        zkFabric = IZKFabric(_zkFabric);
    }

    /// @notice Create a new proposal.
    function createProposal(string calldata description, uint256 duration) external returns (uint256) {
        uint256 proposalId = proposalCount++;
        proposals[proposalId] = Proposal({
            description: description,
            yesVotes: 0,
            noVotes: 0,
            deadline: block.timestamp + duration,
            exists: true
        });

        emit ProposalCreated(proposalId, description, block.timestamp + duration);
        return proposalId;
    }

    /// @notice Cast an anonymous vote with a ZK proof.
    /// @param proposalId The proposal to vote on
    /// @param choice 1 = yes, 0 = no
    /// @param proof Groth16 proof elements
    /// @param publicSignals Circuit public signals (52 elements)
    function vote(
        uint256 proposalId,
        uint8 choice,
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external {
        require(proposals[proposalId].exists, "PrivateGovernance: proposal does not exist");
        require(block.timestamp < proposals[proposalId].deadline, "PrivateGovernance: voting ended");
        require(choice <= 1, "PrivateGovernance: invalid choice");

        // Scope = keccak256("governance-v1", proposalId) — unique per proposal
        // Reduce mod BN128 field prime so it matches circuit field element
        uint256 BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        uint256 scope = uint256(keccak256(abi.encodePacked("zkfabric-governance-v1", proposalId))) % BN128_FIELD_PRIME;

        // Verify proof and record nullifier (prevents double voting)
        zkFabric.verifyAndRecord(proof, publicSignals, scope);

        // Record vote
        if (choice == 1) {
            proposals[proposalId].yesVotes++;
        } else {
            proposals[proposalId].noVotes++;
        }

        emit VoteCast(proposalId, choice, publicSignals[2]);
    }

    /// @notice Get the scope for a given proposal (dApps use this to generate proofs).
    function getProposalScope(uint256 proposalId) external pure returns (uint256) {
        uint256 BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        return uint256(keccak256(abi.encodePacked("zkfabric-governance-v1", proposalId))) % BN128_FIELD_PRIME;
    }

    /// @notice Get proposal results.
    function getResults(uint256 proposalId) external view returns (
        uint256 yesVotes,
        uint256 noVotes,
        bool ended
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.yesVotes, p.noVotes, block.timestamp >= p.deadline);
    }
}
