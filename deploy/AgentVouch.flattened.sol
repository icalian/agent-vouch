// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// src/AgentVouch.sol

/// @notice Minimal interface of the Agent ID registry (ERC-721).
/// @dev Only balanceOf is needed: holding an Agent ID (balance > 0) is the
///      gate. The registry is non-transferable and one-per-user, so one
///      address can hold at most one Agent ID.
interface IAgentIDRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentVouch
/// @notice Sybil-resistant vouching between Agent ID holders.
/// @dev One vouch per holder, forever. No admin, no payable functions, holds
///      no funds, no deadlines, no strings, no dynamic arrays. The registry
///      address is immutable after deployment, so there is nothing to govern.
contract AgentVouch {
    error ZeroRegistry();
    error NotAgentIDHolder();
    error AlreadyVouched();
    error ZeroSubject();
    error SelfVouch();

    event Vouched(address indexed voucher, address indexed subject);

    /// @notice Agent ID registry (ERC-721). Immutable after deployment.
    IAgentIDRegistry public immutable registry;

    /// @notice Subject vouched for by each voucher. address(0) = never vouched
    ///         (a zero subject is rejected, so this doubles as the "has
    ///         vouched" flag and saves a second storage slot per voucher).
    mapping(address => address) private _vouchedFor;

    /// @notice Number of vouches received per subject.
    mapping(address => uint256) private _vouchCount;

    /// @notice Total number of vouches ever recorded.
    uint256 private _totalVouches;

    /// @param _registry Address of the Agent ID ERC-721 registry.
    constructor(address _registry) {
        if (_registry == address(0)) revert ZeroRegistry();
        registry = IAgentIDRegistry(_registry);
    }

    /// @notice Vouch for a subject. Callable once per holder, forever.
    /// @param subject The address being vouched for.
    function vouch(address subject) external {
        if (subject == address(0)) revert ZeroSubject();
        if (subject == msg.sender) revert SelfVouch();
        if (_vouchedFor[msg.sender] != address(0)) revert AlreadyVouched();
        if (registry.balanceOf(msg.sender) == 0) revert NotAgentIDHolder();
        _vouchedFor[msg.sender] = subject;
        unchecked {
            ++_vouchCount[subject];
            ++_totalVouches;
        }
        emit Vouched(msg.sender, subject);
    }

    /// @notice Number of vouches received by `subject`.
    function vouchCount(address subject) external view returns (uint256) {
        return _vouchCount[subject];
    }

    /// @notice Whether `account` has already used its one vouch.
    function hasVouched(address account) external view returns (bool) {
        return _vouchedFor[account] != address(0);
    }

    /// @notice Subject vouched for by `account`, or address(0) if never vouched.
    function vouchedFor(address account) external view returns (address) {
        return _vouchedFor[account];
    }

    /// @notice Total number of vouches ever recorded.
    function totalVouches() external view returns (uint256) {
        return _totalVouches;
    }

    /// @notice Whether `account` holds an Agent ID (registry balance > 0).
    function isHolder(address account) external view returns (bool) {
        return registry.balanceOf(account) > 0;
    }
}

