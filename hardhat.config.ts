import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  defaultNetwork: "testnet",
  networks: {
    testnet: {
      url: "https://testnet.hashio.io/api",
      // url: "http://localhost:7546",
      accounts: [
        process.env.PRIVATE_KEY as string,
        process.env.PRIVATE_KEY_2 as string,
      ],
      timeout: 1000000,
    },
  },
};

export default config;
