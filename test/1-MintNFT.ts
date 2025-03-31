import { expect } from "chai";
import { ethers } from "hardhat";
import { MintNFT } from "../typechain-types";

let mintNFTContract: MintNFT

describe("Mint NFT", function () {
  it("should deploy the MintNFT contract", async () => {
    mintNFTContract = await ethers.deployContract("MintNFT");
    console.log("MintNFT contract deployed to:", mintNFTContract.target);
    expect(mintNFTContract.target).to.be.properAddress;
  });


  it("should create an NFT", async () => {
    const mintTx = await mintNFTContract.createNFT("Test NFT", "TST", "Test NFT", {
      gasLimit: 250_000,
      value: ethers.parseEther("15")
    });

    await expect(mintTx)
      .to.emit(mintNFTContract, "NFTCreated")
      .withArgs(ethers.isAddress);
  });

  it("should mint an NFT with metadata", async () => {
    // Create metadata for the NFT
    const metadata = [
      ethers.toUtf8Bytes("ipfs://bafkreibr7cyxmy4iyckmlyzige4ywccyygomwrcn4ldcldacw3nxe3ikgq"),
    ];

    const mintTx = await mintNFTContract.mintNFT(metadata, {
      gasLimit: 350_000
    });

    // Verify the NFTMinted event was emitted
    await expect(mintTx)
      .to.emit(mintNFTContract, "NFTMinted");
  });

  it("should transfer the NFT to owner", async () => {
    const [owner] = await ethers.getSigners();
    const serialNumber = 1n; // First minted NFT

    const transferTx = await mintNFTContract.transferNFT(owner.address, serialNumber, {
      gasLimit: 350_000
    });

    // Verify the NFTTransferred event was emitted with correct parameters
    await expect(transferTx)
      .to.emit(mintNFTContract, "NFTTransferred")
      .withArgs(owner.address, serialNumber);
  });

  it("should transfer the NFT back to contract before burning", async () => {
    const [owner] = await ethers.getSigners();
    const serialNumber = 1n;
    const tokenAddress = await mintNFTContract.getTokenAddress();

    // Get the NFT contract interface
    const nftContract = await ethers.getContractAt("IERC721", tokenAddress);

    // First approve the contract to handle the transfer
    await nftContract.approve(mintNFTContract.target, serialNumber);

    // Then transfer from owner back to contract
    await nftContract.transferFrom(
      owner.address,
      mintNFTContract.target,
      serialNumber,
      {
        gasLimit: 350_000
      }
    );

    // Verify the NFT is now owned by the contract
    expect(await nftContract.ownerOf(serialNumber))
      .to.equal(mintNFTContract.target);
  });

  it("should burn the minted NFT", async () => {
    // Create serial numbers array for the NFT to burn
    const serialNumbers = [1n]; // Assuming the first minted NFT has serial number 1

    const burnTx = await mintNFTContract.burnNFT(serialNumbers, {
      gasLimit: 60_000
    });

    // Verify the NFTBurned event was emitted
    await expect(burnTx)
      .to.emit(mintNFTContract, "NFTBurned");
  });
});
