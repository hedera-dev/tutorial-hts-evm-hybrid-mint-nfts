import { expect } from "chai";
import { ethers, config, network } from "hardhat";
// import { HDNodeWallet, Wallet } from "ethers";
// import { HardhatEthersHelpers } from "hardhat/types";
import { KYCandUpdateNFT } from "../typechain-types";
import { AccountId, Client, PrivateKey, TokenAssociateTransaction, TokenId } from "@hashgraph/sdk";

function getSignerCompressedPublicKey(
    index = 0,
    asBuffer = true,
    prune0x = true
) {
    const wallet = new ethers.Wallet(
        // @ts-ignore
        config.networks[network.name].accounts[index]
    );
    const cpk = prune0x
        ? wallet.signingKey.compressedPublicKey.replace('0x', '')
        : wallet.signingKey.compressedPublicKey;

    return asBuffer ? Buffer.from(cpk, 'hex') : cpk;
}

describe("KYC and Update NFT", function () {
    let kycNftContract: KYCandUpdateNFT;
    let account1: any;
    let account2: any; // Will be generated

    before(async () => {
        [account1] = await ethers.getSigners();

        // Generate a new random wallet for account2 and connect it to the provider
        account2 = ethers.Wallet.createRandom().connect(ethers.provider);

        // Fund the new account2 from account1 to activate its EVM alias
        console.log(`Funding account ${account2.address} from ${account1.address}`);
        const tx = await account1.sendTransaction({
            to: account2.address,
            value: ethers.parseEther("20") // Send 0.1 HBAR
        });
        await tx.wait();
        console.log(`Account ${account2.address} funded.`);
    });

    it("should deploy the KYCandUpdateNFT contract", async () => {
        kycNftContract = await ethers.deployContract("KYCandUpdateNFT");
        console.log("KYCandUpdateNFT contract deployed to:", kycNftContract.target);
        expect(kycNftContract.target).to.be.properAddress;
    });

    it("should create an NFT", async () => {
        const createTx = await kycNftContract.createNFT(
            "KYC Test NFT",
            "KYCNFT",
            "NFT with KYC",
            {
                gasLimit: 250_000,
                value: ethers.parseEther("7")
            }
        );

        await expect(createTx)
            .to.emit(kycNftContract, "NFTCreated")
            .withArgs(ethers.isAddress);
    });

    it("should associate NFT to account 1 and 2", async () => {
        const tokenAddress = await kycNftContract.getTokenAddress();
        const client = Client.forTestnet()
        // botch job
        // const accountId1 = "0.0.5115129"
        // const accountId2 = "0.0.5259540"
        // temp comment out... need to fix this, it should work
        const accountId1 = await AccountId.fromEvmAddress(0, 0, account1.address).populateAccountNum(client)
        accountId1.evmAddress = null // setting evm to null so that sdk priorities the account num as client
        const privateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY as string)
        client.setOperator(accountId1, privateKey);

        // Derive accountId2 and its private key from the generated ethers wallet
        const accountId2 = await AccountId.fromEvmAddress(0, 0, account2.address).populateAccountNum(client)
        accountId2.evmAddress = null
        const privateKey2 = PrivateKey.fromStringECDSA(account2.privateKey); // Use the private key from the generated wallet

        // Create TokenAssociateTransaction and sign with account1's key
        const transaction = new TokenAssociateTransaction()
            .setAccountId(accountId1)
            .setTokenIds([TokenId.fromSolidityAddress(tokenAddress)])
        const txResponse = await transaction.execute(client);
        const receipt = await txResponse.getReceipt(client);
        expect(receipt.status._code).to.equal(22);

        // associated token to second account
        const transaction2 = new TokenAssociateTransaction()
            .setAccountId(accountId2)
            .setTokenIds([TokenId.fromSolidityAddress(tokenAddress)])
            .freezeWith(client)
        const signedTx2 = await transaction2.sign(privateKey2);
        const txResponse2 = await signedTx2.execute(client);
        const receipt2 = await txResponse2.getReceipt(client);
        expect(receipt2.status._code).to.equal(22);
    });


    it("should mint an NFT with metadata", async () => {
        const metadata = [
            ethers.toUtf8Bytes("ipfs://bafkreibr7cyxmy4iyckmlyzige4ywccyygomwrcn4ldcldacw3nxe3ikgq"),
        ];

        const mintTx = await kycNftContract.mintNFT(metadata, {
            gasLimit: 350_000
        });

        await expect(mintTx)
            .to.emit(kycNftContract, "NFTMinted");
    });

    it("should fail to transfer NFT to account without KYC", async () => {
        const serialNumber = 1n; // First minted NFT

        await expect(
            kycNftContract.transferNFT(account1.address, serialNumber, {
                gasLimit: 350_000
            })
        ).to.be.reverted;
    });

    it("should grant KYC to account1", async () => {
        const grantKycTx = await kycNftContract.grantKYC(account1.address, {
            gasLimit: 350_000
        });

        await expect(grantKycTx)
            .to.emit(kycNftContract, "KYCGranted")
            .withArgs(account1.address);
    });

    it("should successfully transfer NFT to account with KYC", async () => {
        const serialNumber = 1n;

        const transferTx = await kycNftContract.transferNFT(
            account1.address,
            serialNumber,
            {
                gasLimit: 350_000
            }
        );

        await expect(transferTx)
            .to.emit(kycNftContract, "NFTTransferred")
            .withArgs(account1.address, serialNumber);

        // Verify ownership
        const tokenAddress = await kycNftContract.getTokenAddress();
        const nftContract = await ethers.getContractAt("IERC721", tokenAddress);
        expect(await nftContract.ownerOf(serialNumber)).to.equal(account1.address);
    });

    it("should successfully update KYC key to account1", async () => {
        const account1CompressedPublicKey = getSignerCompressedPublicKey(0)
        const updateKycTx = await kycNftContract.updateKYCKey(account1CompressedPublicKey, {
            gasLimit: 350_000
        });

        await expect(updateKycTx)
            .to.emit(kycNftContract, "KYCKeyUpdated")
            .withArgs(account1CompressedPublicKey);
    });

    it("should fail to grant KYC to account2 after KYC key update", async () => {
        await expect(
            kycNftContract.grantKYC(account2.address, {
                gasLimit: 350_000
            })
        ).to.be.reverted
    });

});
