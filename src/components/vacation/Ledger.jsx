import { useState } from "react";
import { formatCents, parseDollarsToCents } from "../../lib/vacationMath.js";
import { updateExpense, deleteExpense, timestampToMs } from "../../lib/vacation.js";

function formatWhen(ts) {
  const ms = timestampToMs(ts);
  if (!ms) return "";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(ts) {
  const ms = timestampToMs(ts);
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditRow({ code, expense, onCancel }) {
  const [amount, setAmount] = useState((expense.amountCents / 100).toFixed(2));
  const [place, setPlace] = useState(expense.place);
  const [description, setDescription] = useState(expense.description || "");
  const [spentAt, setSpentAt] = useState(toDateTimeLocal(expense.spentAt));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSave = async () => {
    const cents = parseDollarsToCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErr("Enter an amount greater than $0.");
      return;
    }
    if (cents > 10_000_000) {
      setErr("Amount seems too high — double-check.");
      return;
    }
    if (!place.trim()) {
      setErr("Place is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await updateExpense(code, expense.id, {
        amountCents: cents,
        place,
        description,
        spentAt: spentAt ? new Date(spentAt) : new Date(),
      });
      onCancel();
    } catch (e) {
      setErr("Couldn't save — check your connection.");
      setSaving(false);
    }
  };

  return (
    <div className="vacation-card" style={{ padding: "1rem", background: "var(--cream)" }}>
      <div style={{ display: "grid", gap: "0.6rem", marginBottom: "0.75rem" }}>
        <input
          className="vacation-input"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
        <input
          className="vacation-input"
          type="text"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Place"
        />
        <input
          className="vacation-input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <input
          className="vacation-input"
          type="datetime-local"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
        />
      </div>
      {err && (
        <div style={{ color: "var(--rust)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          {err}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn-primary" disabled={saving} onClick={handleSave} style={{ flex: 1 }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn-secondary" disabled={saving} onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ExpenseRow({ code, expense, isMine }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${expense.place}" — ${formatCents(expense.amountCents)}?`)) return;
    setDeleting(true);
    try {
      await deleteExpense(code, expense.id);
    } catch {
      setDeleting(false);
      window.alert("Couldn't delete — check your connection.");
    }
  };

  if (editing) {
    return <EditRow code={code} expense={expense} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="vacation-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-display" style={{ fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.15 }}>
            {expense.place}
          </div>
          {expense.description && (
            <div style={{ color: "var(--ink)", fontSize: "0.9rem", marginTop: "0.15rem" }}>
              {expense.description}
            </div>
          )}
          <div
            className="font-mono"
            style={{
              fontSize: "0.7rem",
              color: "var(--dusty)",
              marginTop: "0.4rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {expense.paidByFamilyName} · {formatWhen(expense.spentAt)}
          </div>
        </div>
        <div
          className="font-display"
          style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--rust)", whiteSpace: "nowrap" }}
        >
          {formatCents(expense.amountCents)}
        </div>
      </div>
      {isMine && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-ghost" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Ledger({ code, expenses, myFamilyId }) {
  if (expenses.length === 0) {
    return (
      <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          No expenses yet
        </div>
        <p style={{ color: "var(--dusty)", margin: 0 }}>Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="slide-up" style={{ display: "grid", gap: "0.75rem" }}>
      {expenses.map((e) => (
        <ExpenseRow key={e.id} code={code} expense={e} isMine={e.paidByFamilyId === myFamilyId} />
      ))}
    </div>
  );
}
