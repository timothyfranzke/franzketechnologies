import { useMemo } from "react";
import { computeNets, computeSettlement, formatCents } from "../../lib/vacationMath.js";
import { timestampToMs } from "../../lib/vacation.js";

export default function Dashboard({ trip, expenses, myFamilyId }) {
  const families = trip.families || [];

  const { totalSpent, nets, transactions } = useMemo(() => {
    const enriched = families.map((f) => ({
      id: f.id,
      name: f.name,
      joinedAtMs: timestampToMs(f.joinedAt),
    }));
    const { totalSpent, nets } = computeNets(enriched, expenses);
    const transactions = computeSettlement(nets);
    return { totalSpent, nets, transactions };
  }, [families, expenses]);

  if (families.length <= 1) {
    return (
      <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          You're flying solo
        </div>
        <p style={{ color: "var(--dusty)", margin: 0 }}>
          Share the link to get other families on the trip.
        </p>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="vacation-card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          $0 spent
        </div>
        <p style={{ color: "var(--dusty)", margin: 0 }}>
          Nothing to settle yet. Add an expense to get started.
        </p>
      </div>
    );
  }

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
            marginBottom: "0.25rem",
          }}
        >
          Total Spent
        </div>
        <div
          className="font-display"
          style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--ink)", lineHeight: 1 }}
        >
          {formatCents(totalSpent)}
        </div>
        <div style={{ color: "var(--dusty)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Fair share per family: {formatCents(Math.floor(totalSpent / families.length))}
        </div>
      </div>

      <div>
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
          Where each family stands
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {nets.map((n) => {
            const tone = n.net > 0 ? "var(--sage)" : n.net < 0 ? "var(--rust)" : "var(--ink)";
            const label = n.net > 0 ? "owed" : n.net < 0 ? "owes" : "even";
            return (
              <div
                key={n.id}
                className="vacation-card"
                style={{
                  padding: "0.85rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: n.id === myFamilyId ? "var(--cream)" : "var(--paper)",
                }}
              >
                <div>
                  <div className="font-display" style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                    {n.name}
                    {n.id === myFamilyId && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "0.6rem",
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: "var(--rust)",
                          marginLeft: "0.5rem",
                        }}
                      >
                        You
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--dusty)", fontSize: "0.8rem" }}>
                    paid {formatCents(n.paid)} · share {formatCents(n.share)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    className="font-display"
                    style={{ fontSize: "1.3rem", fontWeight: 800, color: tone, lineHeight: 1 }}
                  >
                    {n.net > 0 ? "+" : ""}{formatCents(n.net)}
                  </div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "0.6rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: tone,
                    }}
                  >
                    {label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {transactions.length > 0 && (
        <div>
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
            To Settle Up
          </div>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {transactions.map((t, i) => (
              <div
                key={i}
                className="vacation-card"
                style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}
              >
                <div className="font-display" style={{ fontSize: "1rem", flex: 1 }}>
                  <strong>{t.fromName}</strong>
                  <span style={{ color: "var(--dusty)", margin: "0 0.4rem" }}>pays</span>
                  <strong>{t.toName}</strong>
                </div>
                <div
                  className="font-display"
                  style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--rust)" }}
                >
                  {formatCents(t.amountCents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
