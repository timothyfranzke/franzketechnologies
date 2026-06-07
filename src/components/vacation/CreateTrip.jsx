import { useState } from "react";
import VacationStyles from "./VacationStyles.jsx";
import { createTrip } from "../../lib/vacation.js";
import { upsertTrip } from "../../lib/vacationStorage.js";

export default function CreateTrip() {
  const [tripName, setTripName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!tripName.trim() || !familyName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createTrip({ tripName, familyName });
      upsertTrip({
        code: result.code,
        tripName: result.tripName,
        familyId: result.familyId,
        familyName: result.familyName,
      });
      window.location.href = `/vacation/trip?code=${encodeURIComponent(result.code)}&tab=share`;
    } catch (err) {
      setError(err.message || "Couldn't create the trip. Try again.");
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
            className="font-mono stamp"
            style={{
              fontSize: "0.65rem",
              padding: "0.3rem 0.6rem",
              marginBottom: "1rem",
              textTransform: "uppercase",
            }}
          >
            New Trip
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
            Start a trip
          </h1>
          <p className="font-body" style={{ color: "var(--dusty)", margin: 0 }}>
            You'll get a code and a link to share with the other families.
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
              Trip Name
            </label>
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="Beach Week 2026"
              maxLength={60}
              autoFocus
              className="vacation-input"
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
              placeholder="Smiths"
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
            disabled={submitting || !tripName.trim() || !familyName.trim()}
            style={{ width: "100%" }}
          >
            {submitting ? "Creating…" : "Create trip"}
          </button>
        </form>
      </div>
    </div>
  );
}
