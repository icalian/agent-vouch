// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentVouch} from "../src/AgentVouch.sol";
import {MockAgentID} from "../src/MockAgentID.sol";

/// @notice Local-only deploy: deploys MockAgentID + AgentVouch on anvil and
///         mints mock Agent IDs to the first three default anvil accounts.
///         Run with: forge script script/DeployLocal.s.sol --rpc-url
///         http://127.0.0.1:8545 --broadcast --unlocked --sender <anvil account 0>
///         No private key is used.
contract DeployLocal is Script {
    function run() public {
        address[3] memory holders = [
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
            0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
        ];
        vm.startBroadcast();
        MockAgentID registry = new MockAgentID();
        AgentVouch vouch = new AgentVouch(address(registry));
        for (uint256 i = 0; i < holders.length; i++) {
            registry.mint(holders[i]);
        }
        vm.stopBroadcast();
        console.log("MockAgentID:", address(registry));
        console.log("AgentVouch: ", address(vouch));
    }
}
