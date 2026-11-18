// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockAgentID
/// @notice Local-only mock of the Agent ID registry for tests and local demos.
/// @dev Soulbound: one ID per address, all transfers revert. NOT for mainnet —
///      the real registry address is passed to AgentVouch at deploy time.
contract MockAgentID {
    error Soulbound();
    error AlreadyHasID();
    error ZeroAddress();
    error NonexistentToken();

    string public constant name = "Mock Agent ID";
    string public constant symbol = "MAID";

    uint256 private _nextTokenId = 1;
    mapping(address => uint256) private _balance;
    mapping(uint256 => address) private _ownerOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    /// @notice Mint one Agent ID to `to`. Reverts if `to` already holds one.
    function mint(address to) external returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (_balance[to] != 0) revert AlreadyHasID();
        tokenId = _nextTokenId++;
        _balance[to] = 1;
        _ownerOf[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balance[owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _ownerOf[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }
}
