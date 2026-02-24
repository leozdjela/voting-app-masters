// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/Voting.sol";

contract VotingSolidityTests {

    function createVoting() internal returns (Voting) {
        string[] memory options = new string[](2);
        options[0] = "DA";
        options[1] = "NE";

        Voting voting = new Voting("Pitanje?", options);
        return voting;
    }

    function test_initial_counts_are_zero() public {
        Voting voting = createVoting();

        require(voting.countAt(0) == 0, "count0 not zero");
        require(voting.countAt(1) == 0, "count1 not zero");
    }

    function test_vote_once_per_nullifier() public {
        Voting voting = createVoting();

        bytes32 n = keccak256(abi.encodePacked("userA|poll1|secret"));
        voting.vote(0, n);

        require(voting.countAt(0) == 1, "count0 should be 1");
        require(voting.usedNullifiers(n) == true, "nullifier not marked used");
    }

    function test_second_vote_same_nullifier_reverts() public {
        Voting voting = createVoting();

        bytes32 n = keccak256(abi.encodePacked("userA|poll1|secret"));
        voting.vote(1, n);

        (bool ok, ) = address(voting).call(
            abi.encodeWithSelector(Voting.vote.selector, 0, n)
        );

        require(!ok, "expected revert on second vote");
        require(voting.countAt(1) == 1, "count1 wrong");
    }

    function test_invalid_option_reverts() public {
        Voting voting = createVoting();

        bytes32 n = keccak256(abi.encodePacked("userA|poll1|secret"));

        (bool ok, ) = address(voting).call(
            abi.encodeWithSelector(Voting.vote.selector, 99, n)
        );

        require(!ok, "expected revert on bad option index");
    }
}