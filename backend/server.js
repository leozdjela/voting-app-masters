import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { keccak256, toUtf8Bytes } from "ethers";
import { OAuth2Client } from "google-auth-library";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SERVER_SECRET = process.env.SERVER_SECRET || "dev-secret-change-me";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);



if (!SERVER_SECRET) {
  throw new Error("Missing SERVER_SECRET in .env");
}

// POST /auth/nullifier
// body: { devUser: "userA", pollId: "poll1" }console.log("GOOGLE_CLIENT_ID (backend) =", GOOGLE_CLIENT_ID);
console.log("SERVER_SECRET length =", SERVER_SECRET?.length);
app.post("/auth/nullifier", async (req, res) => {
  try {
    const { idToken, pollId } = req.body || {};
    console.log("HEADERS content-type:", req.headers["content-type"]);
    console.log("BODY:", req.body);
    console.log("GOOGLE_CLIENT_ID (backend) =", GOOGLE_CLIENT_ID);
    console.log("SERVER_SECRET length =", SERVER_SECRET?.length);

    if (!idToken) return res.status(400).json({ error: "Missing idToken" });
    if (!pollId) return res.status(400).json({ error: "Missing pollId" });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: "Server missing GOOGLE_CLIENT_ID" });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const sub = payload?.sub;
    if (!sub) return res.status(401).json({ error: "No sub in token" });

    const material = `${sub}|${pollId}|${SERVER_SECRET}`;
    const nullifier = keccak256(toUtf8Bytes(material));

    return res.status(200).json({ nullifier });
  } catch (e) {
  console.error("nullifier endpoint error:", e?.message || e);
  return res.status(401).json({ error: e?.message || "Invalid Google ID token" });
}
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});