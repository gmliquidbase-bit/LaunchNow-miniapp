import { useEffect, useState } from "react";
import axios from "axios";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { base } from "wagmi/chains";
import { robinhood } from "./wagmi.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NETWORKS = {
  base: {
    name: "Base",
    chainId: base.id,
    explorer: "https://basescan.org",
  },
  robinhood: {
    name: "Robinhood Chain",
    chainId: robinhood.id,
    explorer: "https://robinhoodchain.blockscout.com",
  },
};

const short = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";

function App() {
  const [networkKey, setNetworkKey] = useState("base");
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    image: "",
    website: "",
    twitter: "",
    telegram: "",
  });
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const network = NETWORKS[networkKey];
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: connecting } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: network.chainId });

  useEffect(() => {
    sdk.actions.ready().then(() => setStatus("Ready to launch")).catch(() => {
      setStatus("Open through a Farcaster Mini App host");
    });
  }, []);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const uploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setError("Please upload an image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result || "");
      setForm((current) => ({ ...current, image }));
      setPreview(image);
    };
    reader.readAsDataURL(file);
  };

  const connectWallet = async () => {
    try {
      setError("");
      const connector = connectors[0];
      if (!connector) throw new Error("Farcaster wallet connector unavailable.");
      await connectAsync({ connector });
      setStatus("Wallet connected");
    } catch (err) {
      setError(err.shortMessage || err.message || "Wallet connection failed.");
    }
  };

  const launch = async () => {
    setLoading(true);
    setError("");
    setSuccess(null);

    try {
      if (!address) throw new Error("Connect your wallet first.");
      if (!form.name || !form.symbol || !form.description || !form.image) {
        throw new Error("Token name, ticker, description, and image are required.");
      }

      if (chainId !== network.chainId) {
        setStatus(`Switching to ${network.name}...`);
        await switchChainAsync({ chainId: network.chainId });
      }

      setStatus("Preparing token launch...");
      const response = await axios.post("/api/launch", {
        ...form,
        symbol: form.symbol.toUpperCase(),
        creator: address,
        chain_id: network.chainId,
        market: "standard",
        quote_address: ZERO_ADDRESS,
      });

      const prepared = response?.data?.data;
      const transactions = (prepared?.steps || []).filter(
        (step) => step?.kind === "transaction" && step?.transaction?.to
      );
      if (!transactions.length) throw new Error("No launch transaction returned.");

      const hashes = [];
      for (let index = 0; index < transactions.length; index += 1) {
        const transaction = transactions[index].transaction;
        setStatus(`Confirm transaction ${index + 1} of ${transactions.length}`);
        const hash = await sendTransactionAsync({
          account: address,
          chainId: network.chainId,
          to: transaction.to,
          data: transaction.data,
          value: BigInt(transaction.value || "0"),
        });
        hashes.push(hash);
        if (publicClient) {
          setStatus("Confirming transaction...");
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }
      }

      const tokenAddress =
        prepared?.predicted_token_address || prepared?.token_address || null;
      setSuccess({
        tokenAddress,
        hash: hashes[0],
        launchpad: tokenAddress
          ? `https://launch.o1.exchange/token/${tokenAddress}`
          : "https://launch.o1.exchange",
        transaction: hashes[0]
          ? `${network.explorer}/tx/${hashes[0]}`
          : null,
      });
      setStatus("Token launched successfully");
    } catch (err) {
      setStatus("Launch failed");
      setError(
        err.response?.data?.error ||
          err.shortMessage ||
          err.message ||
          "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="shell success-screen">
        <div className="success-mark">✓</div>
        <span className="eyebrow">LAUNCH SUCCESSFUL</span>
        <h1>Token Launched Successfully</h1>
        <p>Your token is now live on {network.name}.</p>
        {success.tokenAddress && (
          <div className="detail"><span>Token address</span><strong>{short(success.tokenAddress)}</strong></div>
        )}
        {success.hash && (
          <div className="detail"><span>Transaction</span><strong>{short(success.hash)}</strong></div>
        )}
        <a className="primary" href={success.launchpad} target="_blank" rel="noreferrer">
          View on o1 Launchpad ↗
        </a>
        {success.transaction && (
          <a className="secondary" href={success.transaction} target="_blank" rel="noreferrer">
            View Transaction
          </a>
        )}
        <button className="text-button" onClick={() => setSuccess(null)}>
          Launch Another Token
        </button>
      </main>
    );
  }

  return (
    <main className="shell">
      <header>
        <div><span className="eyebrow">POWERED BY O1</span><h1>LaunchNow</h1><p>Launch a token from Farcaster.</p></div>
        <button className="wallet" onClick={connectWallet} disabled={connecting || isConnected}>
          {connecting ? "Connecting..." : isConnected ? short(address) : "Connect Wallet"}
        </button>
      </header>

      <section>
        <h2>Select Network</h2>
        <div className="network-grid">
          {Object.entries(NETWORKS).map(([key, item]) => (
            <button
              key={key}
              className={networkKey === key ? "network active" : "network"}
              onClick={() => setNetworkKey(key)}
              disabled={loading}
            >
              <strong>{item.name}</strong>
              <span>Chain ID {item.chainId}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Token Details</h2>
        <div className="form-grid">
          <label>Token name<input name="name" value={form.name} onChange={update} placeholder="LaunchNow" /></label>
          <label>Ticker<input name="symbol" value={form.symbol} onChange={update} placeholder="LAUNCH" maxLength={15} /></label>
          <label className="wide">Description<textarea name="description" value={form.description} onChange={update} placeholder="Tell the community about your token..." /></label>
          <label className="wide upload">Token logo<input type="file" accept="image/*" onChange={uploadImage} />{preview && <img src={preview} alt="Token preview" />}</label>
          <label className="wide">Website<input name="website" value={form.website} onChange={update} placeholder="https://example.com" /></label>
          <label>X / Twitter<input name="twitter" value={form.twitter} onChange={update} placeholder="@username" /></label>
          <label>Telegram<input name="telegram" value={form.telegram} onChange={update} placeholder="@community" /></label>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      <button className="primary" onClick={launch} disabled={loading || !isConnected}>
        {loading ? status : `Launch on ${network.name} ↗`}
      </button>
      <div className="status">{status}</div>
    </main>
  );
}

export default App;
