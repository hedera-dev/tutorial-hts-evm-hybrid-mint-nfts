import { expect } from "chai";
import { ethers } from "hardhat";
import { MintNFT } from "../typechain-types";

let mintNftContract: MintNFT

describe("Mint NFT", function () {
  it("should deploy the MintNFT contract", async () => {
    mintNftContract = await ethers.deployContract("MintNFT");
    console.log("MintNFT contract deployed to:", mintNftContract.target);
    expect(mintNftContract.target).to.be.properAddress;
  });


  it("should create an NFT", async () => {
    const mintTx = await mintNftContract.createNFT("Test NFT", "TST", "Test NFT", {
      gasLimit: 250_000,
      value: ethers.parseEther("15")
    });

    await expect(mintTx)
      .to.emit(mintNftContract, "NFTCreated")
      .withArgs(ethers.isAddress);
  });

  it("should mint an NFT with metadata", async () => {
    // Create metadata for the NFT
    const metadata = [
      ethers.toUtf8Bytes("ipfs://bafkreibr7cyxmy4iyckmlyzige4ywccyygomwrcn4ldcldacw3nxe3ikgq"),
    ];

    const mintTx = await mintNftContract.mintNFT(metadata, {
      gasLimit: 350_000
    });

    // Verify the NFTMinted event was emitted
    await expect(mintTx)
      .to.emit(mintNftContract, "NFTMinted");
  });

  it("should transfer the NFT to owner", async () => {
    const [owner] = await ethers.getSigners();
    const serialNumber = 1n; // First minted NFT

    const transferTx = await mintNftContract.transferNFT(owner.address, serialNumber, {
      gasLimit: 350_000
    });

    // Verify the NFTTransferred event was emitted with correct parameters
    await expect(transferTx)
      .to.emit(mintNftContract, "NFTTransferred")
      .withArgs(owner.address, serialNumber);
  });

  it("should transfer the NFT back to contract before burning", async () => {
    const [owner] = await ethers.getSigners();
    const serialNumber = 1n;
    const tokenAddress = await mintNftContract.getTokenAddress();

    // Get the NFT contract interface
    const nftContract = await ethers.getContractAt("IERC721", tokenAddress);

    // First approve the contract to handle the transfer
    await nftContract.approve(mintNftContract.target, serialNumber);

    // Then transfer from owner back to contract
    await nftContract.transferFrom(
      owner.address,
      mintNftContract.target,
      serialNumber,
      {
        gasLimit: 350_000
      }
    );

    // Verify the NFT is now owned by the contract
    expect(await nftContract.ownerOf(serialNumber))
      .to.equal(mintNftContract.target);
  });

  it("should burn the minted NFT", async () => {
    // Create serial numbers array for the NFT to burn
    const serialNumbers = [1n]; // Assuming the first minted NFT has serial number 1

    const burnTx = await mintNftContract.burnNFT(serialNumbers, {
      gasLimit: 60_000
    });

    // Verify the NFTBurned event was emitted
    await expect(burnTx)
      .to.emit(mintNftContract, "NFTBurned");
  });
});
