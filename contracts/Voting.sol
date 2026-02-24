// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Anonymous SSO-based voting (nullifier-based)
/// @notice Stores only vote counts + used nullifiers (no identity on-chain)
contract Voting {
    /// @notice Human-readable poll question
    string public question;

    /// @dev Options are stored privately; accessed via functions below
    string[] private _options;

    /// @dev Vote counters; index corresponds to option index
    uint256[] private _counts;

    /// @notice Nullifier usage registry: true if already used to vote
    mapping(bytes32 => bool) public usedNullifiers;

    /// @notice Emitted when a vote is successfully cast
    event VoteCast(bytes32 indexed nullifier, uint256 indexed optionIndex);

    /// @param _question Poll question
    /// @param options_ List of options (e.g., ["DA","NE"])
    constructor(string memory _question, string[] memory options_) {
        require(bytes(_question).length > 0, "Empty question");
        require(options_.length >= 2, "Need >= 2 options");

        question = _question;

        for (uint256 i = 0; i < options_.length; i++) {
            require(bytes(options_[i]).length > 0, "Empty option");
            _options.push(options_[i]);
            _counts.push(0);
        }
    }

    /// @notice Number of options
    function optionsCount() external view returns (uint256) {
        return _options.length;
    }

    /// @notice Read option text by index
    function optionAt(uint256 index) external view returns (string memory) {
        require(index < _options.length, "Bad option index");
        return _options[index];
    }

    /// @notice Read vote count by option index
    function countAt(uint256 index) external view returns (uint256) {
        require(index < _counts.length, "Bad option index");
        return _counts[index];
    }

    /// @notice Cast a vote once per nullifier
    /// @param optionIndex index of selected option
    /// @param nullifier anonymous unique value (derived off-chain from SSO)
    function vote(uint256 optionIndex, bytes32 nullifier) external {
        require(!usedNullifiers[nullifier], "Already voted");
        require(optionIndex < _options.length, "Bad option index");

        usedNullifiers[nullifier] = true;
        _counts[optionIndex] += 1;

        emit VoteCast(nullifier, optionIndex);
    }
}