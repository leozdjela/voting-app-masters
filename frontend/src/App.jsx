import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import votingArtifact from "./abi/Voting.json";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const BACKEND_URL = "http://localhost:3001/auth/nullifier";

export default function App() {
  const abi = votingArtifact.abi;

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([]);
  const [counts, setCounts] = useState([]);

  const [devUser, setDevUser] = useState("userA");
  const [pollId, setPollId] = useState("poll1");
  const [nullifier, setNullifier] = useState("");

  const [selectedIndex, setSelectedIndex] = useState(0);

  const hasEthereum = typeof window !== "undefined" && window.ethereum;

  // Read-only provider (for reading contract state)
  const providerRead = useMemo(() => {
    try {
      if (!hasEthereum) return null;
      return new ethers.BrowserProvider(window.ethereum);
    } catch {
      return null;
    }
  }, [hasEthereum]);

  const contractRead = useMemo(() => {
    if (!providerRead) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, abi, providerRead);
  }, [providerRead, abi]);

  async function connectWallet() {
    try {
      setError("");
      setStatus("Connecting wallet...");

      if (!window.ethereum?.request) {
        throw new Error("MetaMask request API not available");
      }

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      console.log("eth_requestAccounts ->", accounts);

      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      console.log("eth_chainId ->", chainIdHex);

      const acc = accounts?.[0] || "";
      const id = chainIdHex ? parseInt(chainIdHex, 16).toString() : "";

      setAccount(acc);
      setChainId(id);

      setStatus("Wallet connected ✅");
    } catch (e) {
      console.error("connectWallet error:", e);
      setStatus("");
      setError(e?.message || String(e));
    }
  }

  async function loadPoll() {
    try {
      setError("");
      setStatus("Loading poll...");

      if (!contractRead) {
        throw new Error("Contract not ready (MetaMask/provider missing?)");
      }

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

  async function fetchNullifier() {
    try {
      setError("");
      setStatus("Fetching nullifier from backend...");
      setNullifier("");

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devUser, pollId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.nullifier) throw new Error("Backend did not return nullifier");

      setNullifier(data.nullifier);
      setStatus("Nullifier fetched ✅");
    } catch (e) {
      console.error("fetchNullifier error:", e);
      setStatus("");
      setError(e?.message || String(e));
    }
  }

  async function vote() {
    try {
      setError("");

      if (!window.ethereum?.request) throw new Error("MetaMask not detected");
      if (!account) throw new Error("Connect wallet first");
      if (!nullifier) throw new Error("Nullifier is missing. Click 'Get nullifier' first.");

      setStatus("Preparing transaction...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contractWrite = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      setStatus("Sending vote transaction (check MetaMask)...");
      const tx = await contractWrite.vote(selectedIndex, nullifier);

      setStatus(`Tx sent: ${tx.hash}. Waiting confirmation...`);
      await tx.wait();

      setStatus("Vote confirmed ✅ Refreshing results...");
      await loadPoll();
      setStatus("Done ✅");
    } catch (e) {
      console.error("vote error:", e);
      const msg = e?.shortMessage || e?.message || String(e);
      setStatus("");
      setError(msg);
    }
  }

  // Auto-load poll when contractRead becomes available
  useEffect(() => {
    loadPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractRead]);

  // Auto-read existing account + chain on page load (helps when already connected)
  useEffect(() => {
    (async () => {
      try {
        if (!window.ethereum?.request) return;

        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });

        console.log("on mount eth_accounts ->", accounts);
        console.log("on mount eth_chainId ->", chainIdHex);

        if (accounts?.[0]) setAccount(accounts[0]);
        if (chainIdHex) setChainId(parseInt(chainIdHex, 16).toString());
      } catch (e) {
        console.error("mount read error:", e);
      }
    })();
  }, []);

  // Listen for account/network changes in MetaMask
  useEffect(() => {
    if (!window.ethereum?.on) return;

    const onAccountsChanged = (accounts) => {
      console.log("accountsChanged ->", accounts);
      setAccount(accounts?.[0] || "");
    };

    const onChainChanged = (newChainIdHex) => {
      console.log("chainChanged ->", newChainIdHex);
      const id = parseInt(newChainIdHex, 16).toString();
      setChainId(id);
      loadPoll();
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractRead]);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>Voting dApp (SSO-nullifier DEV mode)</h1>

      {!hasEthereum && (
        <p style={{ color: "crimson" }}>
          MetaMask nije pronađen. Instaliraj MetaMask i osvježi stranicu.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={connectWallet} disabled={!hasEthereum}>
          {account ? "Wallet connected" : "Connect Wallet"}
        </button>

        <div style={{ opacity: 0.85 }}>
          <div><b>Account:</b> {account || "-"}</div>
          <div><b>ChainId:</b> {chainId || "-"}</div>
          <div><b>Contract:</b> {CONTRACT_ADDRESS}</div>
        </div>
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

      <h2>DEV SSO simulacija (backend)</h2>
      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <label>
          devUser (simulira SSO sub):
          <input
            value={devUser}
            onChange={(e) => setDevUser(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label>
          pollId:
          <input
            value={pollId}
            onChange={(e) => setPollId(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <button onClick={fetchNullifier}>Get nullifier</button>

        <div style={{ wordBreak: "break-all", background: "#f6f6f6", padding: 10, borderRadius: 8 }}>
          <b>nullifier:</b> {nullifier || "-"}
        </div>

        <button onClick={vote} disabled={!nullifier || !account}>
          Vote
        </button>
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