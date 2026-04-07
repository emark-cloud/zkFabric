// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ZKFabricMultisig — minimal M-of-N multisig owner
/// @notice Replaces single-EOA ownership of ZKFabricRegistry, ZKFabricVerifier,
///         and RevocationRegistry with a threshold-signed executor. Intentionally
///         tiny (~100 lines) so its behavior is auditable at a glance; on chains
///         where Gnosis Safe is canonically deployed, a Safe SHOULD be preferred
///         over this contract.
///
///         Flow:
///           1. An owner calls `submit(to, value, data)` and auto-confirms.
///           2. Other owners call `confirm(id)` until `threshold` is reached.
///           3. Any owner calls `execute(id)`; the stored call runs from this
///              contract's context, so `msg.sender` on the target is the multisig.
contract ZKFabricMultisig {
    address[] public owners;
    uint256 public immutable threshold;
    mapping(address => bool) public isOwner;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
    }

    Transaction[] private _txs;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    event Submitted(uint256 indexed id, address indexed proposer, address to, uint256 value, bytes data);
    event Confirmed(uint256 indexed id, address indexed signer);
    event Executed(uint256 indexed id, bool success, bytes returnData);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "ZKFabricMultisig: not owner");
        _;
    }

    constructor(address[] memory _owners, uint256 _threshold) {
        require(_owners.length > 0, "ZKFabricMultisig: no owners");
        require(_threshold > 0 && _threshold <= _owners.length, "ZKFabricMultisig: bad threshold");
        for (uint256 i = 0; i < _owners.length; i++) {
            address o = _owners[i];
            require(o != address(0), "ZKFabricMultisig: zero owner");
            require(!isOwner[o], "ZKFabricMultisig: duplicate owner");
            isOwner[o] = true;
            owners.push(o);
        }
        threshold = _threshold;
    }

    /// @notice Propose a new transaction and auto-confirm as the proposer.
    function submit(address to, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (uint256 id)
    {
        id = _txs.length;
        _txs.push(Transaction({to: to, value: value, data: data, executed: false, confirmations: 0}));
        emit Submitted(id, msg.sender, to, value, data);
        _confirm(id);
    }

    /// @notice Add another owner's confirmation to a pending transaction.
    function confirm(uint256 id) external onlyOwner {
        _confirm(id);
    }

    function _confirm(uint256 id) internal {
        require(id < _txs.length, "ZKFabricMultisig: unknown tx");
        Transaction storage t = _txs[id];
        require(!t.executed, "ZKFabricMultisig: executed");
        require(!confirmed[id][msg.sender], "ZKFabricMultisig: already confirmed");
        confirmed[id][msg.sender] = true;
        t.confirmations += 1;
        emit Confirmed(id, msg.sender);
    }

    /// @notice Execute a transaction that has reached the confirmation threshold.
    function execute(uint256 id) external onlyOwner {
        require(id < _txs.length, "ZKFabricMultisig: unknown tx");
        Transaction storage t = _txs[id];
        require(!t.executed, "ZKFabricMultisig: executed");
        require(t.confirmations >= threshold, "ZKFabricMultisig: below threshold");
        t.executed = true;
        (bool ok, bytes memory ret) = t.to.call{value: t.value}(t.data);
        emit Executed(id, ok, ret);
        require(ok, "ZKFabricMultisig: call failed");
    }

    function ownersCount() external view returns (uint256) {
        return owners.length;
    }

    function transactionCount() external view returns (uint256) {
        return _txs.length;
    }

    function getTransaction(uint256 id)
        external
        view
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 confirmations)
    {
        Transaction storage t = _txs[id];
        return (t.to, t.value, t.data, t.executed, t.confirmations);
    }

    receive() external payable {}
}
