import { useMemo, useState } from "react";

function buildLink(code, familyName) {
  if (typeof window === "undefined") return "";
  const base = `${window.location.origin}/vacation/trip?code=${encodeURIComponent(code)}`;
  if (!familyName.trim()) return base;
  return `${base}&family=${encodeURIComponent(familyName.trim())}`;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", value);
    }
  };
  return (
    <button type="button" className="btn-secondary" onClick={handle} style={{ whiteSpace: "nowrap" }}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function Share({ trip, code }) {
  const [recipientFamily, setRecipientFamily] = useState("");
  const baseLink = useMemo(() => buildLink(code, ""), [code]);
  const prefilledLink = useMemo(() => buildLink(code, recipientFamily), [code, recipientFamily]);

  return (
    <div className="slide-up" style={{ display: "grid", gap: "1.25rem" }}>
      <div className="vacation-card" style={{ padding: "1.25rem", textAlign: "center" }}>
        <div
          className="font-mono"
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "var(--dusty)",
            marginBottom: "0.5rem",
          }}
        >
          Trip Code
        </div>
        <div
          className="font-display"
          style={{
            fontSize: "3rem",
            fontWeight: 900,
            letterSpacing: "0.25em",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          {code}
        </div>
        <p style={{ color: "var(--dusty)", marginTop: "0.75rem", marginBottom: 0, fontSize: "0.9rem" }}>
          Tell other families to enter this code at{" "}
          <span className="font-mono">/vacation/join</span>
        </p>
      </div>

      <div className="vacation-card" style={{ padding: "1.25rem" }}>
        <div
          className="font-mono"
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          Shareable Link
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
          <input readOnly value={baseLink} className="vacation-input font-mono" style={{ fontSize: "0.85rem" }} />
          <CopyButton value={baseLink} />
        </div>
        <p style={{ color: "var(--dusty)", marginTop: "0.5rem", marginBottom: 0, fontSize: "0.85rem" }}>
          Recipient picks their family name on the join screen.
        </p>
      </div>

      <div className="vacation-card" style={{ padding: "1.25rem" }}>
        <div
          className="font-mono"
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          Pre-filled Link for a Specific Family
        </div>
        <input
          type="text"
          value={recipientFamily}
          onChange={(e) => setRecipientFamily(e.target.value)}
          placeholder="Family name (e.g. Joneses)"
          className="vacation-input"
          style={{ marginBottom: "0.75rem" }}
        />
        {recipientFamily.trim() && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
            <input
              readOnly
              value={prefilledLink}
              className="vacation-input font-mono"
              style={{ fontSize: "0.85rem" }}
            />
            <CopyButton value={prefilledLink} />
          </div>
        )}
      </div>

      <div className="vacation-card" style={{ padding: "1.25rem" }}>
        <div
          className="font-mono"
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "var(--dusty)",
            marginBottom: "0.5rem",
          }}
        >
          Families on this trip
        </div>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          {(trip.families || []).map((f) => (
            <div key={f.id} className="font-display" style={{ fontSize: "1rem" }}>
              {f.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
