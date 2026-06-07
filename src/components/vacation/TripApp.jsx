import { useEffect, useMemo, useState } from "react";
import VacationStyles from "./VacationStyles.jsx";
import Dashboard from "./Dashboard.jsx";
import Ledger from "./Ledger.jsx";
import AddExpense from "./AddExpense.jsx";
import Share from "./Share.jsx";
import OfflineBanner from "./OfflineBanner.jsx";
import {
  subscribeTrip,
  subscribeExpenses,
  joinTrip,
} from "../../lib/vacation.js";
import {
  getTrip as getStoredTrip,
  upsertTrip,
  touchTrip,
} from "../../lib/vacationStorage.js";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "ledger", label: "Ledger" },
  { id: "add", label: "Add" },
  { id: "share", label: "Share" },
];

function readQuery() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    codeParam: (params.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    familyParam: params.get("family"),
    tabParam: params.get("tab"),
  };
}

function stripQueryKeeping(keepKeys = []) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const next = new URLSearchParams();
  for (const k of keepKeys) {
    const v = url.searchParams.get(k);
    if (v) next.set(k, v);
  }
  const search = next.toString();
  const newUrl = `${url.pathname}${search ? "?" + search : ""}${url.hash}`;
  window.history.replaceState({}, "", newUrl);
}

export default function TripApp({ code: codeProp }) {
  const [code, setCode] = useState(codeProp || "");

  useEffect(() => {
    if (codeProp) return;
    const { codeParam } = readQuery();
    if (codeParam) setCode(codeParam);
  }, [codeProp]);

  if (!code) {
    return (
      <Shell>
        <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            No trip code
          </div>
          <p style={{ color: "var(--dusty)", marginBottom: "1rem" }}>
            This link doesn't include a trip code.
          </p>
          <a href="/vacation" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
            Back to vacation
          </a>
        </div>
      </Shell>
    );
  }

  return <TripAppInner code={code} />;
}

function TripAppInner({ code }) {
  const [trip, setTrip] = useState(undefined); // undefined = loading, null = not found
  const [expenses, setExpenses] = useState([]);
  const [stored, setStored] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [tripError, setTripError] = useState(null);
  const [autoJoinError, setAutoJoinError] = useState(null);
  const [switchPrompt, setSwitchPrompt] = useState(null); // { from, to }

  useEffect(() => {
    const unsub = subscribeTrip(
      code,
      (t) => setTrip(t),
      (err) => setTripError(err?.message || "Couldn't load this trip.")
    );
    return unsub;
  }, [code]);

  useEffect(() => {
    const unsub = subscribeExpenses(code, (items) => setExpenses(items));
    return unsub;
  }, [code]);

  useEffect(() => {
    setStored(getStoredTrip(code));
  }, [code]);

  // Handle ?family= auto-join + ?tab= once we have trip data
  useEffect(() => {
    if (trip === undefined) return; // still loading
    if (trip === null) return; // not found
    const { familyParam, tabParam } = readQuery();
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setTab(tabParam);
    }
    if (!familyParam) {
      stripQueryKeeping(["code"]);
      return;
    }
    const trimmed = familyParam.trim();
    if (!trimmed) {
      stripQueryKeeping(["code"]);
      return;
    }

    const existingOnTrip = (trip.families || []).find(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase()
    );
    const local = getStoredTrip(code);

    // If this device already has a family for this trip and it differs from the link, ask before switching
    if (local && existingOnTrip && local.familyId !== existingOnTrip.id) {
      setSwitchPrompt({ from: local.familyName, to: existingOnTrip.name, targetFamily: existingOnTrip });
      return;
    }
    if (local && !existingOnTrip && local.familyName.toLowerCase() !== trimmed.toLowerCase()) {
      // Link wants us to be a different family that doesn't exist yet on the trip.
      setSwitchPrompt({ from: local.familyName, to: trimmed, targetFamily: null });
      return;
    }

    (async () => {
      try {
        const result = await joinTrip({ code, familyName: trimmed });
        upsertTrip({
          code: result.code,
          tripName: result.tripName,
          familyId: result.familyId,
          familyName: result.familyName,
        });
        setStored(getStoredTrip(code));
        stripQueryKeeping(["code"]);
      } catch (err) {
        setAutoJoinError(err.message || "Couldn't join this trip with that family name.");
      }
    })();
  }, [trip, code]);

  // Touch lastOpenedAt once on entry
  useEffect(() => {
    if (stored) touchTrip(code);
  }, [stored?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const myFamily = useMemo(() => {
    if (!trip || !stored) return null;
    return (trip.families || []).find((f) => f.id === stored.familyId) || null;
  }, [trip, stored]);

  // ─── Loading ─────────────────────────────────────────────
  if (trip === undefined) {
    return (
      <Shell>
        <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "1.2rem" }}>Loading trip…</div>
        </div>
      </Shell>
    );
  }

  // ─── Trip not found ──────────────────────────────────────
  if (trip === null) {
    return (
      <Shell>
        <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Trip not found
          </div>
          <p style={{ color: "var(--dusty)" }}>The code <strong>{code}</strong> doesn't match any trip.</p>
          <a href="/vacation" className="btn-primary" style={{ display: "inline-block", marginTop: "0.5rem", textDecoration: "none" }}>
            Back to vacation
          </a>
        </div>
      </Shell>
    );
  }

  // ─── Trip exists but we have an unresolved switch prompt ─
  if (switchPrompt) {
    const handleSwitch = async () => {
      try {
        const result = await joinTrip({ code, familyName: switchPrompt.to });
        upsertTrip({
          code: result.code,
          tripName: result.tripName,
          familyId: result.familyId,
          familyName: result.familyName,
        });
        setStored(getStoredTrip(code));
        setSwitchPrompt(null);
        stripQueryKeeping(["code"]);
      } catch (err) {
        setAutoJoinError(err.message || "Couldn't switch families.");
        setSwitchPrompt(null);
      }
    };
    const handleStay = () => {
      setSwitchPrompt(null);
      stripQueryKeeping(["code"]);
    };
    return (
      <Shell trip={trip}>
        <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Switch families?
          </div>
          <p style={{ color: "var(--ink)", marginBottom: "1rem" }}>
            This device is currently <strong>{switchPrompt.from}</strong> on this trip. The link wants you to be <strong>{switchPrompt.to}</strong>.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button className="btn-primary" onClick={handleSwitch}>Switch to {switchPrompt.to}</button>
            <button className="btn-secondary" onClick={handleStay}>Stay as {switchPrompt.from}</button>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── Trip exists but no family on this device ───────────
  if (!stored) {
    return (
      <Shell trip={trip}>
        <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Join this trip
          </div>
          <p style={{ color: "var(--dusty)", marginBottom: "1rem" }}>
            Enter your family name to start tracking expenses on <strong>{trip.name}</strong>.
          </p>
          <a
            href={`/vacation/join?code=${encodeURIComponent(code)}`}
            className="btn-primary"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            Enter family name
          </a>
        </div>
      </Shell>
    );
  }

  // ─── Family was forgotten on the trip — re-bind needed ──
  if (!myFamily) {
    return (
      <Shell trip={trip}>
        <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Family not found on this trip
          </div>
          <p style={{ color: "var(--dusty)", marginBottom: "1rem" }}>
            This device thinks you're <strong>{stored.familyName}</strong>, but that family isn't on this trip anymore.
          </p>
          <a
            href={`/vacation/join?code=${encodeURIComponent(code)}`}
            className="btn-primary"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            Rejoin
          </a>
        </div>
      </Shell>
    );
  }

  // ─── Normal trip view ────────────────────────────────────
  return (
    <Shell trip={trip} myFamily={myFamily}>
      <OfflineBanner />
      {autoJoinError && (
        <div
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
          {autoJoinError}
        </div>
      )}

      <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab-btn"
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <Dashboard trip={trip} expenses={expenses} myFamilyId={myFamily.id} />
      )}
      {tab === "ledger" && (
        <Ledger code={code} expenses={expenses} myFamilyId={myFamily.id} />
      )}
      {tab === "add" && (
        <AddExpense
          code={code}
          family={{ id: myFamily.id, name: myFamily.name }}
          onDone={() => setTab("dashboard")}
        />
      )}
      {tab === "share" && <Share trip={trip} code={code} />}

      {tripError && (
        <div style={{ marginTop: "1rem", color: "var(--rust)", fontSize: "0.85rem" }}>
          {tripError}
        </div>
      )}
    </Shell>
  );
}

function Shell({ trip, myFamily, children }) {
  return (
    <div className="paper-texture" style={{ minHeight: "100vh" }}>
      <VacationStyles />
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
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
            ← Switch trip
          </a>
          {myFamily && (
            <div className="font-mono" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--ink)" }}>
              {myFamily.name}
            </div>
          )}
        </div>

        {trip && (
          <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
            <div
              className="font-mono"
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "var(--rust)",
                marginBottom: "0.35rem",
              }}
            >
              {trip.code}
            </div>
            <h1
              className="font-display"
              style={{
                fontSize: "2.2rem",
                fontWeight: 900,
                lineHeight: 1,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              {trip.name}
            </h1>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
