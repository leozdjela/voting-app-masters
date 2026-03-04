import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import votingArtifact from "./abi/Voting.json";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL;
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const SEPOLIA_CHAIN_ID_DEC = "11155111";

export default function App() {
  const abi = votingArtifact.abi;

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [idToken, setIdToken] = useState("");

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([]);
  const [counts, setCounts] = useState([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [nullifier, setNullifier] = useState("");
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  const [txHash, setTxHash] = useState("");

  // Read-only provider preko Sepolia RPC (nema MetaMaska)
  const providerRead = useMemo(() => {
    try {
      if (!SEPOLIA_RPC_URL) return null;
      return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    } catch {
      return null;
    }
  }, []);

  const contractRead = useMemo(() => {
    if (!providerRead || !CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, abi, providerRead);
  }, [providerRead, abi]);

  async function loadPoll() {
    try {
      setError("");
      setStatus("Loading poll from Sepolia...");

      if (!contractRead) throw new Error("Contract/provider not ready (check VITE_SEPOLIA_RPC_URL & VITE_CONTRACT_ADDRESS)");

      const q = await contractRead.question();
      const n = await contractRead.optionsCount();

      const opts = [];
      const cts = [];

      for (let i = 0; i < Number(n); i++) {
        opts.push(await contractRead.optionAt(i));
        cts.push(Number(await contractRead.countAt(i)));
      }

      setQuestion(q);
      setOptions(opts);
      setCounts(cts);

      setStatus("Poll loaded ✅");
    } catch (e) {
      console.error("loadPoll error:", e);
      setStatus("");
      setError(e?.message || String(e));
    }
  }

  async function checkNullifierUsed(n) {
    if (!contractRead || !n) return false;
    try {
      const used = await contractRead.usedNullifiers(n);
      setAlreadyVoted(Boolean(used));
      return Boolean(used);
    } catch {
      setAlreadyVoted(false);
      return false;
    }
  }

  // (opcionalno) dohvat nullifiera odmah nakon login-a
  async function fetchNullifier() {
    try {
      setError("");
      setStatus("Computing nullifier...");

      setNullifier("");
      setAlreadyVoted(false);

      if (!idToken) throw new Error("Google login required.");

      const res = await fetch(`${BACKEND_URL}/auth/nullifier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, contractAddress: CONTRACT_ADDRESS }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || `Backend error ${res.status}`);
      if (!data.nullifier) throw new Error("Backend did not return nullifier");

      setNullifier(data.nullifier);
      await checkNullifierUsed(data.nullifier);

      setStatus("Nullifier ready ✅");
    } catch (e) {
      console.error("fetchNullifier error:", e);
      setStatus("");
      setError(e?.message || String(e));
    }
  }

  // ✅ GASLESS VOTE (nema MetaMaska)
  async function voteGasless() {
    try {
      setError("");
      setTxHash("");
      setStatus("Sending gasless vote (backend relayer)...");

      if (!idToken) throw new Error("Google login required.");
      if (!contractRead) throw new Error("Contract not ready.");

      // ako već znamo da je voted, blokiraj UI
      if (alreadyVoted) throw new Error("Already voted");

      const res = await fetch(`${BACKEND_URL}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          contractAddress: CONTRACT_ADDRESS,
          optionIndex: selectedIndex,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 409 -> already voted
        if (res.status === 409) {
          setAlreadyVoted(true);
          throw new Error("Već ste glasali (SSO račun je već iskorišten).");
        }
        throw new Error(data?.error || `Backend error ${res.status}`);
      }

      const hash = data.txHash;
      if (!hash) throw new Error("Backend did not return txHash");

      setTxHash(hash);
      setStatus("Transaction sent ✅ Waiting confirmation...");

      // backend već čeka 1 confirm, ali za UX možemo ipak refreshati rezultate
      await loadPoll();

      // ako backend vrati nullifier, možemo odmah provjeriti usedNullifiers
      if (data.nullifier) {
        setNullifier(data.nullifier);
        await checkNullifierUsed(data.nullifier);
      }

      setStatus("Vote confirmed ✅");
    } catch (e) {
      console.error("voteGasless error:", e);
      setStatus("");
      setError(e?.message || String(e));
    }
  }

  // Google button init
  useEffect(() => {
    if (!window.google?.accounts?.id) return;
    if (!GOOGLE_CLIENT_ID) {
      setError("Missing VITE_GOOGLE_CLIENT_ID in frontend/.env");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        setIdToken(resp?.credential || "");
        setError("");
        setStatus("Google login ok ✅");
      },
    });

    window.google.accounts.id.renderButton(
      document.getElementById("googleBtn"),
      { theme: "outline", size: "large" }
    );
  }, []);

  // Load poll on mount
  useEffect(() => {
    loadPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractRead]);

  // kad se token postavi, odmah izračunaj nullifier + provjeri already voted
  useEffect(() => {
    if (idToken) fetchNullifier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 760, margin: "40px auto", padding: 16 }}>
      <h1>Voting dApp (Gasless + Google SSO)</h1>

      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        <div><b>Network:</b> Sepolia ({SEPOLIA_CHAIN_ID_DEC})</div>
        <div><b>Contract:</b> {CONTRACT_ADDRESS || "-"}</div>
      </div>

      <div id="googleBtn" />

      <div style={{ marginTop: 10, wordBreak: "break-all", background: "#f6f6f6", padding: 10, borderRadius: 8 }}>
        <b>ID token:</b> {idToken ? `${idToken.slice(0, 18)}...` : "-"}
      </div>

      <hr style={{ margin: "18px 0" }} />

      <h2>Pitanje</h2>
      <p style={{ fontSize: 18 }}>{question || "..."}</p>

      <h3>Opcije</h3>
      {options.length === 0 ? (
        <p>Učitavanje...</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {options.map((opt, i) => (
            <label key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                name="opt"
                checked={selectedIndex === i}
                onChange={() => setSelectedIndex(i)}
              />
              <span style={{ minWidth: 60 }}>{opt}</span>
              <span style={{ opacity: 0.75 }}>({counts[i] ?? 0} glasova)</span>
            </label>
          ))}
        </div>
      )}

      <hr style={{ margin: "18px 0" }} />

      <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <div style={{ wordBreak: "break-all", background: "#f6f6f6", padding: 10, borderRadius: 8 }}>
          <b>nullifier:</b> {nullifier || "-"}
        </div>

        {nullifier && alreadyVoted && (
          <p style={{ color: "crimson", marginTop: 6 }}>
            Već ste glasali (ovaj SSO račun je već iskorišten za ovu anketu).
          </p>
        )}

        <button onClick={voteGasless} disabled={!idToken || alreadyVoted || options.length === 0}>
          Vote (gasless)
        </button>

        {txHash && (
          <div style={{ wordBreak: "break-all", background: "#f6f6f6", padding: 10, borderRadius: 8 }}>
            <b>Tx hash:</b> {txHash}
            <div style={{ marginTop: 6 }}>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Open on Etherscan
              </a>
            </div>
          </div>
        )}
      </div>

      {status && (
        <p style={{ marginTop: 16 }}>
          <b>Status:</b> {status}
        </p>
      )}
      {error && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          <b>Error:</b> {error}
        </p>
      )}

      <hr style={{ margin: "18px 0" }} />
      <button onClick={loadPoll}>Refresh results</button>
    </div>
  );
}