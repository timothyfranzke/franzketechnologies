import { useEffect, useState } from "react";
import VacationStyles from "./VacationStyles.jsx";
import { joinTrip } from "../../lib/vacation.js";
import { upsertTrip } from "../../lib/vacationStorage.js";

export default function JoinTrip() {
  const [code, setCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const presetCode = params.get("code");
    if (presetCode) setCode(presetCode.toUpperCase());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!code.trim() || !familyName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinTrip({ code, familyName });
      upsertTrip({
        code: result.code,
        tripName: result.tripName,
        familyId: result.familyId,
        familyName: result.familyName,
      });
      window.location.href = `/vacation/trip?code=${encodeURIComponent(result.code)}`;
    } catch (err) {
      setError(err.message || "Couldn't join the trip.");
      setSubmitting(false);
    }
  };

  return (
    <div className="paper-texture" style={{ minHeight: "100vh" }}>
      <VacationStyles />
      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <a
            href="/vacation"
            className="font-mono"
            style={{
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--dusty)",
              textDecoration: "none",
            }}
          >
            ← Back
          </a>
        </div>

        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            className="font-mono"
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--rust)",
              marginBottom: "0.5rem",
            }}
          >
            Join a Trip
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: "2.5rem",
              fontWeight: 900,
              lineHeight: 1,
              margin: "0 0 0.5rem",
              color: "var(--ink)",
            }}
          >
            Enter the code
          </h1>
          <p className="font-body" style={{ color: "var(--dusty)", margin: 0 }}>
            Ask the trip creator for the 6-character code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="vacation-card slide-up" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              className="font-mono"
              style={{
                display: "block",
                fontSize: "0.65rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "var(--ink)",
                marginBottom: "0.4rem",
              }}
            >
              Trip Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="K7M2PQ"
              maxLength={6}
              autoFocus
              className="vacation-input font-mono"
              style={{
                letterSpacing: "0.3em",
                textAlign: "center",
                fontSize: "1.25rem",
                fontWeight: 700,
              }}
            />
          </div>
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              className="font-mono"
              style={{
                display: "block",
                fontSize: "0.65rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "var(--ink)",
                marginBottom: "0.4rem",
              }}
            >
              Your Family Name
            </label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Joneses"
              maxLength={40}
              className="vacation-input"
            />
          </div>

          {error && (
            <div
              className="font-body"
              style={{
                color: "var(--rust)",
                background: "rgba(193, 74, 51, 0.08)",
                border: "1px solid var(--rust)",
                borderRadius: "0.5rem",
                padding: "0.6rem 0.75rem",
                marginBottom: "1rem",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || code.length < 6 || !familyName.trim()}
            style={{ width: "100%" }}
          >
            {submitting ? "Joining…" : "Join trip"}
          </button>
        </form>
      </div>
    </div>
  );
}
