// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./hedera/HederaTokenService.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/KeyHelper.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";

contract MintNFT is HederaTokenService, KeyHelper {
    address private tokenAddress;
    address private owner;

    event NFTCreated(address tokenAddress);
    event NFTMinted(int64 newTotalSupply, int64[] serialNumbers);
    event NFTBurned(int responseCode, int64 newTotalSupply);
    event NFTTransferred(address receiver, uint256 serialNumber);
    event HBARReceived(address sender, uint256 amount);
    event HBARFallback(address sender, uint256 amount, bytes data);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function createNFT(
        string memory name,
        string memory symbol,
        string memory memo
    ) external payable onlyOwner {
        // Create the royalty fee
        IHederaTokenService.RoyaltyFee[]
            memory royaltyFees = new IHederaTokenService.RoyaltyFee[](1);
        royaltyFees[0] = IHederaTokenService.RoyaltyFee({
            numerator: 1,
            denominator: 10,
            amount: 100000000,
            tokenId: address(0),
            useHbarsForPayment: true,
            feeCollector: owner
        });

        // Create fixed fees array (empty for this example)
        IHederaTokenService.FixedFee[]
            memory fixedFees = new IHederaTokenService.FixedFee[](0);

        // Create token details
        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.memo = memo;
        token.treasury = address(this);

        // set supply key
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = getSingleKey(
            KeyType.SUPPLY,
            KeyValueType.CONTRACT_ID,
            address(this)
        );
        token.tokenKeys = keys;

        (
            int responseCode,
            address createdToken
        ) = createNonFungibleTokenWithCustomFees(token, fixedFees, royaltyFees);

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Failed to create NFT"
        );
        tokenAddress = createdToken;
        emit NFTCreated(createdToken);
    }

    function mintNFT(bytes[] memory metadata) external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");

        (
            int responseCode,
            int64 newTotalSupply,
            int64[] memory serialNumbers
        ) = mintToken(tokenAddress, 0, metadata);

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Failed to mint NFT"
        );
        emit NFTMinted(newTotalSupply, serialNumbers);
    }

    function burnNFT(int64[] memory serialNumbers) external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");

        (int responseCode, int64 newTotalSupply) = burnToken(
            tokenAddress,
            0,
            serialNumbers
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Failed to burn NFT"
        );
        emit NFTBurned(responseCode, newTotalSupply);
    }

    function transferNFT(address receiver, uint256 serialNumber) external {
        require(tokenAddress != address(0), "Token not created yet");
        IERC721(tokenAddress).transferFrom(
            address(this),
            receiver,
            serialNumber
        );
        emit NFTTransferred(receiver, serialNumber);
    }

    function getTokenAddress() external view returns (address) {
        return tokenAddress;
    }

    receive() external payable {
        emit HBARReceived(msg.sender, msg.value);
    }

    fallback() external payable {
        emit HBARFallback(msg.sender, msg.value, msg.data);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function withdrawHBAR() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No HBAR to withdraw");

        (bool success, ) = owner.call{value: balance}("");
        require(success, "Failed to withdraw HBAR");
    }
}
