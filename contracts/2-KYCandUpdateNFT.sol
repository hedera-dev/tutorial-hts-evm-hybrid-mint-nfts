// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./hedera/HederaTokenService.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/KeyHelper.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";

contract KYCandUpdateNFT is HederaTokenService, KeyHelper {
    address private tokenAddress;
    address private owner;

    event NFTCreated(address tokenAddress);
    event NFTMinted(int64 newTotalSupply, int64[] serialNumbers);
    event NFTTransferred(address receiver, uint256 serialNumber);
    event KYCGranted(address account);
    event KYCRevoked(address account);
    event KYCKeyUpdated(bytes newKey);
    event HBARReceived(address sender, uint256 amount);

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
        // Create token details
        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.memo = memo;
        token.treasury = address(this);

        // Set up token keys - Admin, Supply, and KYC
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](3);

        // Admin key - for updating token properties
        keys[0] = getSingleKey(
            KeyType.ADMIN,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        // Supply key - for minting/burning
        keys[1] = getSingleKey(
            KeyType.SUPPLY,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        // KYC key - for managing KYC
        keys[2] = getSingleKey(
            KeyType.KYC,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        token.tokenKeys = keys;

        (int responseCode, address createdToken) = createNonFungibleToken(
            token
        );

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

    function transferNFT(address receiver, uint256 serialNumber) external {
        require(tokenAddress != address(0), "Token not created yet");
        IERC721(tokenAddress).transferFrom(
            address(this),
            receiver,
            serialNumber
        );
        emit NFTTransferred(receiver, serialNumber);
    }

    function grantKYC(address account) external {
        require(tokenAddress != address(0), "Token not created yet");
        int response = grantTokenKyc(tokenAddress, account);
        require(response == HederaResponseCodes.SUCCESS, "Failed to grant KYC");
        emit KYCGranted(account);
    }

    function revokeKYC(address account) external {
        require(tokenAddress != address(0), "Token not created yet");
        int response = revokeTokenKyc(tokenAddress, account);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to revoke KYC"
        );
        emit KYCRevoked(account);
    }

    function updateKYCKey(bytes memory newKYCKey) external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");

        // Create a new TokenKey array with just the KYC key
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = getSingleKey(KeyType.KYC, KeyValueType.SECP256K1, newKYCKey);

        int responseCode = updateTokenKeys(tokenAddress, keys);
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Failed to update KYC key"
        );

        emit KYCKeyUpdated(newKYCKey);
    }

    function getTokenAddress() external view returns (address) {
        return tokenAddress;
    }

    receive() external payable {
        emit HBARReceived(msg.sender, msg.value);
    }
}
