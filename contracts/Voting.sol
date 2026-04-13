// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    string public question;
    string[] private _options;
    uint256[] private _counts;

    mapping(bytes32 => bool) public usedNullifiers;
    
    event VoteCast(bytes32 indexed nullifier, uint256 indexed optionIndex);

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

    function optionsCount() external view returns (uint256) {
        return _options.length;
    }

    function optionAt(uint256 index) external view returns (string memory) {
        require(index < _options.length, "Bad option index");
        return _options[index];
    }

    function countAt(uint256 index) external view returns (uint256) {
        require(index < _counts.length, "Bad option index");
        return _counts[index];
    }

    function vote(uint256 optionIndex, bytes32 nullifier) external {
        require(!usedNullifiers[nullifier], "Already voted");
        require(optionIndex < _options.length, "Bad option index");

        usedNullifiers[nullifier] = true;
        _counts[optionIndex] += 1;

        emit VoteCast(nullifier, optionIndex);
    }
}