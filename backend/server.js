require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { randomUUID } = require("crypto");

const app = express();
const API = "https://api.launch.o1.exchange/v1";
const SUPPORTED_CHAINS = new Set([8453, 4663]);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function isValidEvmAddress(address) {
  return typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function imageToBase64(image) {
  if (!image) return null;

  if (typeof image === "string" && image.startsWith("data:image/")) {
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) throw new Error("Invalid data URL image format.");
    return { image_type: match[1], image_base64: match[2] };
  }

  const response = await axios.get(image, {
    responseType: "arraybuffer",
    timeout: 20000,
    headers: { "User-Agent": "LaunchNow/1.0", Accept: "image/*,*/*;q=0.8" },
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to fetch image URL. HTTP ${response.status}`);
  }

  const contentType = response.headers["content-type"] || "image/png";
  return {
    image_type: contentType.split(";")[0].trim(),
    image_base64: Buffer.from(response.data).toString("base64"),
  };
}

app.get("/", (_req, res) => {
  res.json({
    status: "LaunchNow Backend Running",
    supported_chains: [
      { chain_id: 8453, name: "Base" },
      { chain_id: 4663, name: "Robinhood Chain" },
    ],
  });
});

app.get("/health", async (_req, res) => {
  try {
    const response = await axios.get(`${API}/health`, { timeout: 15000 });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: error.message }
    );
  }
});

app.post("/api/launch", async (req, res) => {
  try {
    const {
      name,
      symbol,
      description,
      image,
      website,
      twitter,
      telegram,
      creator,
      chain_id,
      market,
      quote_address,
    } = req.body;

    if (!name || !symbol || !description || !image) {
      return res.status(400).json({
        error: "Token name, ticker, description, and image are required.",
      });
    }

    const selectedChainId = Number(chain_id || 8453);
    if (!SUPPORTED_CHAINS.has(selectedChainId)) {
      return res.status(400).json({
        error: "Unsupported network. Select Base or Robinhood Chain.",
      });
    }

    const creatorAddress = creator || process.env.O1_CREATOR_ADDRESS;
    if (!isValidEvmAddress(creatorAddress)) {
      return res.status(400).json({ error: "Creator must be a valid EVM address." });
    }

    const normalizedSymbol = String(symbol).trim().toUpperCase();
    if (!/^[A-Z0-9]{1,15}$/.test(normalizedSymbol)) {
      return res.status(400).json({
        error: "Token ticker must contain 1-15 letters or numbers.",
      });
    }

    const imageData = await imageToBase64(image);
    const payload = {
      chain_id: selectedChainId,
      creator: creatorAddress,
      market: market || "standard",
      quote_address: quote_address || "0x0000000000000000000000000000000000000000",
      token: {
        name: String(name).trim(),
        symbol: normalizedSymbol,
        description: String(description).trim(),
        website: typeof website === "string" ? website.trim() : "",
        x: typeof twitter === "string" ? twitter.trim() : "",
        telegram: typeof telegram === "string" ? telegram.trim() : "",
        editable_metadata: false,
        extra_metadata: [],
        image_base64: imageData.image_base64,
        image_type: imageData.image_type,
      },
      allocations: [],
      vesting: [],
    };

    const response = await axios.post(`${API}/launches/prepare`, payload, {
      headers: {
        "x-api-key": process.env.O1_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      timeout: 30000,
    });

    res.json(response.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: error.message || "An unexpected server error occurred.",
    });
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`LaunchNow Backend running on :${PORT}`);
});
