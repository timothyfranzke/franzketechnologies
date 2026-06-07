import { useState } from "react";
import { parseDollarsToCents } from "../../lib/vacationMath.js";
import { addExpense } from "../../lib/vacation.js";

function nowLocalDateTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddExpense({ code, family, onDone }) {
  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [spentAt, setSpentAt] = useState(nowLocalDateTime());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const cents = parseDollarsToCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    if (cents > 10_000_000) {
      setError("Amount seems too high — double-check.");
      return;
    }
    if (!place.trim()) {
      setError("Place is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addExpense(code, {
        amountCents: cents,
        place,
        description,
        spentAt: spentAt ? new Date(spentAt) : new Date(),
        paidByFamilyId: family.id,
        paidByFamilyName: family.name,
      });
      onDone();
    } catch {
      setError("Couldn't save — check your connection.");
      setSaving(false);
    }
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.65rem",
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: "var(--ink)",
    marginBottom: "0.4rem",
  };

  return (
    <form onSubmit={handleSubmit} className="vacation-card slide-up" style={{ padding: "1.25rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <label className="font-mono" style={labelStyle}>Amount (USD)</label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="42.50"
          autoFocus
          className="vacation-input"
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label className="font-mono" style={labelStyle}>Place</label>
        <input
          type="text"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Joe's Crab Shack"
          maxLength={80}
          className="vacation-input"
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label className="font-mono" style={labelStyle}>Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner Friday"
          maxLength={120}
          className="vacation-input"
        />
      </div>
      <div style={{ marginBottom: "1.25rem" }}>
        <label className="font-mono" style={labelStyle}>When</label>
        <input
          type="datetime-local"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
          className="vacation-input"
        />
      </div>

      {error && (
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
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={saving} style={{ width: "100%" }}>
        {saving ? "Saving…" : `Add expense as ${family.name}`}
      </button>
    </form>
  );
}
