import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { keccak256, toUtf8Bytes } from "ethers";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SERVER_SECRET = process.env.SERVER_SECRET;

if (!SERVER_SECRET) {
  throw new Error("Missing SERVER_SECRET in .env");
}

// POST /auth/nullifier
// body: { devUser: "userA", pollId: "poll1" }
app.post("/auth/nullifier", (req, res) => {
  const { devUser, pollId } = req.body;

  if (!devUser || !pollId) {
    return res.status(400).json({ error: "devUser and pollId are required" });
  }

  // deterministički nullifier (isti devUser + isti pollId => isti nullifier)
  const input = `${devUser}|${pollId}|${SERVER_SECRET}`;
  const nullifier = keccak256(toUtf8Bytes(input));

  return res.json({ nullifier });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});