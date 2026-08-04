import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { defineChain } from "viem";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [base, robinhood],
  connectors: [farcasterMiniApp()],
  transports: {
    [base.id]: http(),
    [robinhood.id]: http("https://rpc.mainnet.chain.robinhood.com"),
  },
});
