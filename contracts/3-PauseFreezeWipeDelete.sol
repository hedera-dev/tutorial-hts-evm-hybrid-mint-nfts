// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./hedera/HederaTokenService.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/KeyHelper.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";

contract PauseFreezeWipeDelete is HederaTokenService, KeyHelper {
    address private tokenAddress;
    address private owner;

    event NFTCreated(address tokenAddress);
    event NFTMinted(int64 newTotalSupply, int64[] serialNumbers);
    event NFTTransferred(address receiver, uint256 serialNumber);
    event NFTAssociated(address indexed account);
    event TokenPaused();
    event TokenUnpaused();
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event TokenWiped(address indexed account, int64[] serialNumbers);
    event TokenDeleted();
    event TokenKeyUpdated(uint keyType, bytes newKey);

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

        // Set up all token keys
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](5);

        // Supply key - for minting/burning
        keys[0] = getSingleKey(
            KeyType.SUPPLY,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        // Pause key
        keys[1] = getSingleKey(
            KeyType.PAUSE,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        // Freeze key
        keys[2] = getSingleKey(
            KeyType.FREEZE,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        // Wipe key
        keys[3] = getSingleKey(
            KeyType.WIPE,
            KeyValueType.CONTRACT_ID,
            address(this)
        );

        // Delete key
        keys[4] = getSingleKey(
            KeyType.ADMIN,
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

    function associateNFT(address account) external {
        require(tokenAddress != address(0), "Token not created yet");
        int response = associateToken(account, tokenAddress);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to associate NFT"
        );
        emit NFTAssociated(account);
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

    function pauseToken() external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");
        int response = pauseToken(tokenAddress);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to pause token"
        );
        emit TokenPaused();
    }

    function unpauseToken() external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");
        int response = unpauseToken(tokenAddress);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to unpause token"
        );
        emit TokenUnpaused();
    }

    function freezeAccount(address account) external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");
        int response = freezeToken(tokenAddress, account);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to freeze account"
        );
        emit AccountFrozen(account);
    }

    function unfreezeAccount(address account) external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");
        int response = unfreezeToken(tokenAddress, account);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to unfreeze account"
        );
        emit AccountUnfrozen(account);
    }

    function wipeTokenFromAccount(
        address account,
        int64[] memory serialNumbers
    ) external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");
        int response = wipeTokenAccountNFT(
            tokenAddress,
            account,
            serialNumbers
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to wipe token"
        );
        emit TokenWiped(account, serialNumbers);
    }

    function deleteToken() external onlyOwner {
        require(tokenAddress != address(0), "Token not created yet");
        int response = deleteToken(tokenAddress);
        require(
            response == HederaResponseCodes.SUCCESS,
            "Failed to delete token"
        );
        emit TokenDeleted();
    }

    function getTokenAddress() external view returns (address) {
        return tokenAddress;
    }

    receive() external payable {}
}
