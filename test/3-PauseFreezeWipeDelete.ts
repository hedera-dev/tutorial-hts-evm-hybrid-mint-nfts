import { expect } from "chai";
import { ethers } from "hardhat";
import { PauseFreezeWipeDelete } from "../typechain-types";


describe("Pause Freeze Wipe Delete NFT", function () {
    let nftContract: PauseFreezeWipeDelete;
    let owner: any;

    before(async () => {
        [owner] = await ethers.getSigners();
    });

    it("should deploy the PauseFreezeWipeDelete contract", async () => {
        nftContract = await ethers.deployContract("PauseFreezeWipeDelete");
        console.log("Contract deployed to:", nftContract.target);
        expect(nftContract.target).to.be.properAddress;
    });

    it("should create an NFT", async () => {
        const createTx = await nftContract.createNFT(
            "Control NFT",
            "CTRL",
            "NFT with all control keys",
            {
                gasLimit: 250_000,
                value: ethers.parseEther("7")
            }
        );

        await expect(createTx)
            .to.emit(nftContract, "NFTCreated")
            .withArgs(ethers.isAddress);
    });

    it("should mint NFTs", async () => {
        const metadata = [
            ethers.toUtf8Bytes("ipfs://metadata1"),
            ethers.toUtf8Bytes("ipfs://metadata2"),
            ethers.toUtf8Bytes("ipfs://metadata3"),
        ];

        const mintTx = await nftContract.mintNFT(metadata, {
            gasLimit: 1_000_000
        });

        await expect(mintTx)
            .to.emit(nftContract, "NFTMinted");
    });

    it("should transfer NFT to owner", async () => {
        const serialNumber = 1n;
        const transferTx = await nftContract.transferNFT(owner.address, serialNumber, {
            gasLimit: 350_000
        });

        await expect(transferTx)
            .to.emit(nftContract, "NFTTransferred")
            .withArgs(owner.address, serialNumber);
    });

    it("should pause the token", async () => {
        const pauseTx = await nftContract.pauseToken({
            gasLimit: 350_000
        });

        await expect(pauseTx)
            .to.emit(nftContract, "TokenPaused");

        // Try to transfer while paused - should fail
        const serialNumber = 2n;
        await expect(
            nftContract.transferNFT(owner.address, serialNumber)
        ).to.be.reverted;
    });

    it("should unpause the token", async () => {
        const unpauseTx = await nftContract.unpauseToken({
            gasLimit: 350_000
        });

        await expect(unpauseTx)
            .to.emit(nftContract, "TokenUnpaused");

        // Transfer should work now
        const serialNumber = 2n;
        const transferTx = await nftContract.transferNFT(owner.address, serialNumber);
        await expect(transferTx)
            .to.emit(nftContract, "NFTTransferred")
            .withArgs(owner.address, serialNumber);
    });

    it("should freeze owner", async () => {
        const freezeTx = await nftContract.freezeAccount(owner.address, {
            gasLimit: 350_000
        });

        await expect(freezeTx)
            .to.emit(nftContract, "AccountFrozen")
            .withArgs(owner.address);

        // Try to transfer to frozen account - should fail
        const serialNumber = 3n;
        await expect(
            nftContract.transferNFT(owner.address, serialNumber)
        ).to.be.reverted;
    });

    it("should unfreeze owner", async () => {
        const unfreezeTx = await nftContract.unfreezeAccount(owner.address, {
            gasLimit: 350_000
        });

        await expect(unfreezeTx)
            .to.emit(nftContract, "AccountUnfrozen")
            .withArgs(owner.address);
    });

    it("should wipe NFT from owner", async () => {
        const serialNumbers = [1n];
        const wipeTx = await nftContract.wipeTokenFromAccount(
            owner.address,
            serialNumbers,
            {
                gasLimit: 350_000
            }
        );

        await expect(wipeTx)
            .to.emit(nftContract, "TokenWiped")
            .withArgs(owner.address, serialNumbers);
    });

    it("should delete the token", async () => {
        const deleteTx = await nftContract.deleteToken({
            gasLimit: 350_000
        });

        await expect(deleteTx)
            .to.emit(nftContract, "TokenDeleted");

        // Try to mint after deletion - should fail
        const metadata = [ethers.toUtf8Bytes("ipfs://metadata3")];
        await expect(
            nftContract.mintNFT(metadata)
        ).to.be.reverted;
    });
});
