import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import votingArtifact from "./abi/Voting.json";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://voting-app-masters.onrender.com").replace(/\/+$/, "");
const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL;
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

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

  const [txHash, setTxHash] = useState(""); // ostaje za debug (ne prikazujemo korisniku)

  const [loadingPoll, setLoadingPoll] = useState(false);
  const [loadingNullifier, setLoadingNullifier] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);

  // Modali
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVotedModal, setShowVotedModal] = useState(false);

  // Read-only provider (bez MetaMaska)
  const providerRead = useMemo(() => {
    try {
      if (!SEPOLIA_RPC_URL) return null;
      return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contractRead = useMemo(() => {
    if (!providerRead || !CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, abi, providerRead);
  }, [providerRead, abi]);

  const totalVotes = useMemo(() => {
    return counts.reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [counts]);

  async function loadPoll() {
    try {
      setError("");
      setStatus("Učitavam anketu…");
      setLoadingPoll(true);

      if (!contractRead) throw new Error("Ugovor/provider nije spreman (provjeri VITE_SEPOLIA_RPC_URL i VITE_CONTRACT_ADDRESS).");

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

      setStatus("Anketa učitana ✅");
    } catch (e) {
      console.error("loadPoll error:", e);
      setStatus("");
      setError(e?.message || String(e));
    } finally {
      setLoadingPoll(false);
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

  async function fetchNullifier() {
    try {
      setError("");
      setStatus("Pripremam prijavu za glasanje…");
      setLoadingNullifier(true);

      setNullifier("");
      setAlreadyVoted(false);

      if (!idToken) throw new Error("Potrebna je prijava Google računom.");

      const res = await fetch(`${BACKEND_URL}/auth/nullifier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, contractAddress: CONTRACT_ADDRESS }),
      });

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Backend nije vratio JSON (status ${res.status}).`);
      }

      if (!res.ok) throw new Error(data?.error || `Backend greška ${res.status}`);
      if (!data.nullifier) throw new Error("Backend nije vratio nullifier.");

      setNullifier(data.nullifier);
      await checkNullifierUsed(data.nullifier);

      setStatus("Spremno za glasanje ✅");
    } catch (e) {
      console.error("fetchNullifier error:", e);
      setStatus("");
      setError(e?.message || String(e));
    } finally {
      setLoadingNullifier(false);
    }
  }

  async function voteGasless() {
    try {
      setError("");
      setTxHash("");
      setStatus("Šaljem glas…");
      setSubmittingVote(true);

      if (!idToken) throw new Error("Potrebna je prijava Google računom.");
      if (!contractRead) throw new Error("Ugovor nije spreman.");
      if (alreadyVoted) throw new Error("Već ste glasali.");

      const res = await fetch(`${BACKEND_URL}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          contractAddress: CONTRACT_ADDRESS,
          optionIndex: selectedIndex,
        }),
      });

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Backend nije vratio JSON (status ${res.status}).`);
      }

      if (!res.ok) {
        if (res.status === 409) {
          setAlreadyVoted(true);
          setShowVotedModal(true);
          throw new Error("Već ste glasali (ovaj račun je već iskorišten).");
        }
        throw new Error(data?.error || `Backend greška ${res.status}`);
      }

      const hash = data.txHash;
      if (!hash) throw new Error("Backend nije vratio txHash.");

      setTxHash(hash);
      setStatus("Glas poslan ✅ Osvježavam rezultate…");

      await loadPoll();

      if (data.nullifier) {
        setNullifier(data.nullifier);
        await checkNullifierUsed(data.nullifier);
      }

      setStatus("Glas je zabilježen ✅");
      setShowVotedModal(true);
    } catch (e) {
      console.error("voteGasless error:", e);
      setStatus("");
      setError(e?.message || String(e));
    } finally {
      setSubmittingVote(false);
    }
  }

  // Google button init
  useEffect(() => {
    if (!window.google?.accounts?.id) return;
    if (!GOOGLE_CLIENT_ID) {
      setError("Nedostaje VITE_GOOGLE_CLIENT_ID u env varijablama.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        setIdToken(resp?.credential || "");
        setError("");
        setStatus("Prijava uspješna ✅");
      },
      ux_mode: "popup",
      itp_support: true,
    });

    // render once; element postoji na prvom renderu (nisam prijavljen)
    window.google.accounts.id.renderButton(document.getElementById("googleBtn"), {
      theme: "outline",
      size: "large",
      shape: "pill",
      width: 340,
    });
  }, []);

  // Load poll on mount
  useEffect(() => {
    loadPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractRead]);

  // kad se token postavi, izračunaj nullifier + provjeri already voted
  useEffect(() => {
    if (idToken) fetchNullifier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const canVote =
    Boolean(idToken) &&
    !alreadyVoted &&
    options.length > 0 &&
    !loadingNullifier &&
    !submittingVote;

  return (
    <div style={styles.page} className="app-shell">
      <div className="app-container">
        <header style={{ ...styles.header, justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={styles.h1}>Anketa</h1>
            <p style={styles.sub}>Prijavi se, odaberi opciju i glasaj.</p>
          </div>
        </header>

        <main className="app-grid" style={{ gridTemplateColumns: "1fr" }}>
          {!idToken ? (
            <section style={styles.loginCard} className="card-pad">
              <h2 style={styles.loginTitle}>Prijavi se za glasanje</h2>
              <p style={styles.loginSub}>
                Za glasanje je potreban Google račun kako bismo omogućili <b>1 glas po osobi</b>.
              </p>

              <div style={{ marginTop: 18 }}>
                <div id="googleBtn" />
              </div>

              <div style={styles.loginHint}>
                Nakon prijave prikazat će se anketa i opcije.
                <br> <i>Ako "login" nije prikazan, refresh stranicu </i></br>
              </div>

              {error && (
                <div style={{ ...styles.alertErr, marginTop: 12 }}>
                  <b>Greška:</b> {error}
                </div>
              )}
            </section>
          ) : (
            <section style={styles.card} className="card-pad">
              <div style={styles.cardTop}>
                <h2 style={styles.h2}>Pitanje</h2>
                <button
                  onClick={loadPoll}
                  disabled={loadingPoll}
                  style={{ ...styles.btnGhost, opacity: loadingPoll ? 0.65 : 1 }}
                >
                  {loadingPoll ? "Osvježavam…" : "Osvježi"}
                </button>
              </div>

              <p style={styles.question}>{question || "Učitavanje…"}</p>

              <div style={styles.hr} />

              <div style={styles.cardTop}>
                <h3 style={styles.h3}>{alreadyVoted ? "Rezultati" : "Opcije"}</h3>
                <div style={styles.muted}>
                  Ukupno glasova: <b>{totalVotes}</b>
                </div>
              </div>

              {options.length === 0 ? (
                <div style={styles.skelWrap}>
                  <div style={styles.skel} />
                  <div style={styles.skel} />
                  <div style={styles.skel} />
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  {options.map((opt, i) => {
                    const v = counts[i] ?? 0;
                    const pct = totalVotes > 0 ? (v / totalVotes) * 100 : 0;
                    const selected = selectedIndex === i;

                    return (
                      <label
                        key={i}
                        className="option-pad"
                        style={{
                          ...styles.option,
                          cursor: alreadyVoted ? "default" : "pointer",
                          borderColor: !alreadyVoted && selected
                            ? "rgba(99,102,241,0.55)"
                            : "rgba(148,163,184,0.35)",
                          boxShadow: !alreadyVoted && selected
                            ? "0 0 0 4px rgba(99,102,241,0.12)"
                            : "none",
                        }}
                        onClick={() => {
                          if (!alreadyVoted) setSelectedIndex(i);
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={styles.optionTop}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              {!alreadyVoted ? (
                                <input
                                  type="radio"
                                  name="opt"
                                  checked={selected}
                                  onChange={() => setSelectedIndex(i)}
                                  style={{ transform: "scale(1.1)" }}
                                />
                              ) : (
                                <span style={styles.lockBadge}>✓</span>
                              )}
                              <span style={styles.optionText}>{opt}</span>
                            </div>

                            <div style={styles.optionMeta}>
                              <span style={styles.pill}>{v} glasova</span>
                              <span style={styles.pillMuted}>
                                {clamp(Math.round(pct), 0, 100)}%
                              </span>
                            </div>
                          </div>

                          <div style={styles.progressTrack}>
                            <div
                              style={{
                                ...styles.progressFill,
                                width: `${clamp(pct, 0, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {!alreadyVoted && (
                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!canVote}
                    className="btn-primary"
                    style={{
                      ...styles.btnPrimary,
                      opacity: canVote ? 1 : 0.6,
                      cursor: canVote ? "pointer" : "not-allowed",
                    }}
                  >
                    {submittingVote ? "Glasam…" : "Glasaj"}
                  </button>
                </div>
              )}

              {status && (
                <div style={{ ...styles.alertInfo, marginTop: 12 }}>
                  <b>Info:</b> {status}
                </div>
              )}
              {error && (
                <div style={{ ...styles.alertErr, marginTop: 12 }}>
                  <b>Greška:</b> {error}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Modal: potvrda glasanja */}
      {showConfirm && (
        <div style={styles.modalOverlay} onClick={() => setShowConfirm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Potvrdi glas</h3>
            <p style={styles.modalText}>
              Jeste li sigurni da želite glasati za opciju:
              <br />
              <b>{options[selectedIndex] ?? "—"}</b>?
            </p>

            <div style={styles.modalActions}>
              <button
                style={styles.modalBtnGhost}
                onClick={() => setShowConfirm(false)}
              >
                Odustani
              </button>

              <button
                style={styles.modalBtnPrimary}
                onClick={async () => {
                  setShowConfirm(false);
                  await voteGasless();
                }}
              >
                Potvrdi glas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: već glasano / glas zaprimljen */}
      {showVotedModal && (
        <div style={styles.modalOverlay} onClick={() => setShowVotedModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Već ste glasali ✅</h3>
            <p style={styles.modalText}>
              Vaš glas je zabilježen. Ispod možete vidjeti trenutne rezultate ankete.
            </p>

            <div style={styles.modalActions}>
              <button
                style={styles.modalBtnPrimary}
                onClick={() => setShowVotedModal(false)}
              >
                U redu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 700px at 20% 10%, rgba(99,102,241,0.22), transparent 55%), radial-gradient(900px 600px at 90% 20%, rgba(16,185,129,0.16), transparent 50%), linear-gradient(180deg, #0b1020, #070a12)",
    color: "#e5e7eb",
    padding: "20px clamp(12px, 3vw, 36px)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },

  header: {
    display: "flex",
    justifyContent: "center",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  h1: { fontSize: 40, lineHeight: 1.1, margin: 0, fontWeight: 900 },
  sub: { margin: "10px 0 0", opacity: 0.85, maxWidth: 720, fontSize: 16 },

  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 18,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  h2: { margin: 0, fontSize: 18, opacity: 0.95 },
  h3: { margin: 0, fontSize: 16, opacity: 0.95 },

  question: { fontSize: 20, margin: "10px 0 0", color: "#f3f4f6" },
  muted: { opacity: 0.8, fontSize: 13 },

  hr: {
    height: 1,
    background: "rgba(148,163,184,0.18)",
    margin: "14px 0",
  },

  btnGhost: {
    background: "rgba(148,163,184,0.10)",
    border: "1px solid rgba(148,163,184,0.20)",
    color: "#e5e7eb",
    padding: "8px 10px",
    borderRadius: 12,
    cursor: "pointer",
  },

  option: {
    display: "block",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.35)",
  },

  optionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },

  optionText: { fontSize: 16, color: "#f9fafb" },
  optionMeta: { display: "flex", gap: 8, alignItems: "center" },

  pill: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(99,102,241,0.14)",
    border: "1px solid rgba(99,102,241,0.22)",
  },

  pillMuted: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.10)",
    border: "1px solid rgba(148,163,184,0.18)",
    opacity: 0.9,
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(148,163,184,0.16)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(99,102,241,0.95), rgba(16,185,129,0.85))",
    transition: "width 260ms ease",
  },

  btnPrimary: {
    background:
      "linear-gradient(90deg, rgba(99,102,241,1), rgba(16,185,129,0.95))",
    border: "none",
    color: "#061018",
    fontWeight: 900,
    borderRadius: 14,
  },

  alertInfo: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(99,102,241,0.22)",
  },

  alertErr: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(244,63,94,0.12)",
    border: "1px solid rgba(244,63,94,0.25)",
    color: "#fecdd3",
  },

  skelWrap: { display: "grid", gap: 10, marginTop: 10 },
  skel: {
    height: 56,
    borderRadius: 14,
    background:
      "linear-gradient(90deg, rgba(148,163,184,0.10), rgba(148,163,184,0.18), rgba(148,163,184,0.10))",
    backgroundSize: "200% 100%",
    animation: "pulse 1.2s ease-in-out infinite",
  },

  // Login card (veći)
  loginCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 18,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    maxWidth: 760,
    margin: "0 auto",
    textAlign: "left",
    padding: 28,
  },

  loginTitle: { margin: 0, fontSize: 28, fontWeight: 900 },
  loginSub: { margin: "10px 0 0", opacity: 0.85, lineHeight: 1.6, fontSize: 16 },

  loginHint: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.8,
    borderTop: "1px solid rgba(148,163,184,0.18)",
    paddingTop: 12,
  },

  // Results-only indicator
  lockBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-grid",
    placeItems: "center",
    fontWeight: 900,
    background: "rgba(16,185,129,0.18)",
    border: "1px solid rgba(16,185,129,0.35)",
    color: "#d1fae5",
  },

  // Modals
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 9999,
  },

  modal: {
    width: "min(560px, 95%)",
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
  },

  modalTitle: { margin: 0, fontSize: 20, fontWeight: 900 },

  modalText: { margin: "12px 0", lineHeight: 1.6, opacity: 0.9 },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
    flexWrap: "wrap",
  },

  modalBtnGhost: {
    background: "rgba(148,163,184,0.10)",
    border: "1px solid rgba(148,163,184,0.20)",
    color: "#e5e7eb",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  },

  modalBtnPrimary: {
    background: "linear-gradient(90deg, #6366f1, #10b981)",
    border: "none",
    color: "#061018",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
  },
};