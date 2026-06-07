import { useEffect, useState } from "react";
import VacationStyles from "./VacationStyles.jsx";
import InstallButton from "./InstallButton.jsx";
import { getTrips, removeTrip } from "../../lib/vacationStorage.js";

function TripCard({ trip, onForget, onOpen }) {
  const opened = trip.lastOpenedAt
    ? new Date(trip.lastOpenedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;
  return (
    <div className="vacation-card" style={{ padding: "1.25rem", position: "relative" }}>
      <button
        type="button"
        onClick={() => onForget(trip.code)}
        title="Remove this trip from this device"
        aria-label={`Forget ${trip.tripName}`}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.75rem",
          background: "transparent",
          border: "none",
          color: "var(--dusty)",
          cursor: "pointer",
          fontSize: "1.1rem",
          lineHeight: 1,
          padding: "0.25rem",
        }}
      >
        ✕
      </button>
      <button
        type="button"
        onClick={() => onOpen(trip.code)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          width: "100%",
          cursor: "pointer",
          color: "var(--ink)",
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "var(--dusty)",
            marginBottom: "0.35rem",
          }}
        >
          {trip.code}
        </div>
        <div className="font-display" style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.1 }}>
          {trip.tripName}
        </div>
        <div
          className="font-body"
          style={{ fontSize: "0.9rem", color: "var(--dusty)", marginTop: "0.5rem" }}
        >
          as <strong style={{ color: "var(--ink)" }}>{trip.familyName}</strong>
          {opened ? ` · last opened ${opened}` : ""}
        </div>
      </button>
    </div>
  );
}

export default function VacationLanding() {
  const [trips, setTrips] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTrips(getTrips());
    setReady(true);
  }, []);

  const handleForget = (code) => {
    removeTrip(code);
    setTrips(getTrips());
  };

  const handleOpen = (code) => {
    window.location.href = `/vacation/trip?code=${encodeURIComponent(code)}`;
  };

  return (
    <div className="paper-texture" style={{ minHeight: "100vh" }}>
      <VacationStyles />
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <a
            href="/"
            className="font-mono"
            style={{
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--dusty)",
              textDecoration: "none",
            }}
          >
            ← franzketechnologies.com
          </a>
        </div>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            className="font-mono"
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--rust)",
              marginBottom: "0.5rem",
            }}
          >
            Vacation Ledger
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.95,
              margin: "0 0 0.75rem",
              color: "var(--ink)",
            }}
          >
            Split it. Settle it.
          </h1>
          <p
            className="font-body"
            style={{ fontSize: "1rem", color: "var(--dusty)", margin: 0 }}
          >
            Track what every family spends on a trip. See who owes whom.
          </p>
        </div>

        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <a href="/vacation/new" className="btn-primary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
            Create a trip
          </a>
          <a href="/vacation/join" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
            Enter a code
          </a>
        </div>

        <InstallButton />

        {ready && trips.length > 0 && (
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "var(--dusty)",
                marginBottom: "0.75rem",
              }}
            >
              Your Trips
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {trips.map((t) => (
                <TripCard key={t.code} trip={t} onForget={handleForget} onOpen={handleOpen} />
              ))}
            </div>
          </div>
        )}

        {ready && trips.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 1rem",
              color: "var(--dusty)",
              fontStyle: "italic",
            }}
          >
            No trips yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
