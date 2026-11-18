// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentVouch} from "../src/AgentVouch.sol";
import {MockAgentID} from "../src/MockAgentID.sol";

contract AgentVouchTest is Test {
    AgentVouch public vouch;
    MockAgentID public registry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public carol = makeAddr("carol");
    address public dave = makeAddr("dave"); // never holds an ID

    event Vouched(address indexed voucher, address indexed subject);

    function setUp() public {
        registry = new MockAgentID();
        vouch = new AgentVouch(address(registry));
        registry.mint(alice);
        registry.mint(bob);
        registry.mint(carol);
    }

    function test_ZeroRegistryReverts() public {
        vm.expectRevert(AgentVouch.ZeroRegistry.selector);
        new AgentVouch(address(0));
    }

    function test_RegistryIsImmutable() public view {
        assertEq(address(vouch.registry()), address(registry));
    }

    function test_NonHolderVouchReverts() public {
        vm.prank(dave);
        vm.expectRevert(AgentVouch.NotAgentIDHolder.selector);
        vouch.vouch(alice);
    }

    function test_HolderVouchSucceeds() public {
        vm.prank(alice);
        vouch.vouch(bob);
        assertEq(vouch.vouchCount(bob), 1);
        assertEq(vouch.totalVouches(), 1);
        assertTrue(vouch.hasVouched(alice));
        assertEq(vouch.vouchedFor(alice), bob);
        assertFalse(vouch.hasVouched(bob));
        assertEq(vouch.vouchedFor(bob), address(0));
    }

    function test_SecondVouchReverts() public {
        vm.prank(alice);
        vouch.vouch(bob);
        vm.prank(alice);
        vm.expectRevert(AgentVouch.AlreadyVouched.selector);
        vouch.vouch(carol);
        // State unchanged by the reverted call.
        assertEq(vouch.vouchCount(carol), 0);
        assertEq(vouch.totalVouches(), 1);
        assertEq(vouch.vouchedFor(alice), bob);
    }

    function test_SelfVouchReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgentVouch.SelfVouch.selector);
        vouch.vouch(alice);
        assertFalse(vouch.hasVouched(alice));
    }

    function test_ZeroSubjectReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgentVouch.ZeroSubject.selector);
        vouch.vouch(address(0));
        assertFalse(vouch.hasVouched(alice));
    }

    function test_MultipleVouchersSameSubject() public {
        vm.prank(alice);
        vouch.vouch(carol);
        vm.prank(bob);
        vouch.vouch(carol);
        assertEq(vouch.vouchCount(carol), 2);
        assertEq(vouch.totalVouches(), 2);
        assertEq(vouch.vouchCount(alice), 0);
        assertEq(vouch.vouchCount(bob), 0);
    }

    function test_VouchForNonHolderSubjectCounts() public {
        // The subject does not need to hold an Agent ID; only the voucher does.
        vm.prank(alice);
        vouch.vouch(dave);
        assertEq(vouch.vouchCount(dave), 1);
        assertEq(vouch.totalVouches(), 1);
    }

    function test_ViewsBeforeAnyVouch() public view {
        assertEq(vouch.vouchCount(alice), 0);
        assertEq(vouch.totalVouches(), 0);
        assertFalse(vouch.hasVouched(alice));
        assertEq(vouch.vouchedFor(alice), address(0));
        assertTrue(vouch.isHolder(alice));
        assertFalse(vouch.isHolder(dave));
    }

    function test_EmitsVouchedEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Vouched(alice, bob);
        vm.prank(alice);
        vouch.vouch(bob);
    }

    function test_MockSoulboundTransfersRevert() public {
        vm.prank(alice);
        vm.expectRevert(MockAgentID.Soulbound.selector);
        registry.transferFrom(alice, bob, 1);
        vm.prank(alice);
        vm.expectRevert(MockAgentID.Soulbound.selector);
        registry.safeTransferFrom(alice, bob, 1);
    }

    function test_MockOneIdPerAddress() public {
        vm.expectRevert(MockAgentID.AlreadyHasID.selector);
        registry.mint(alice);
        assertEq(registry.balanceOf(alice), 1);
    }
}
