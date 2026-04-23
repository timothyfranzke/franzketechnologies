import React, { useState } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase.js";

function generateApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `ft_${key}`;
}

export default function ClientForm({ client, onCancel, onSaved }) {
  const isEditing = !!client;

  const [name, setName] = useState(client?.name || "");
  const [domain, setDomain] = useState(client?.domain || "");
  const [recipients, setRecipients] = useState(
    client?.recipients?.join(", ") || ""
  );
  const [apiKey, setApiKey] = useState(client?.apiKey || generateApiKey());
  const [fromName, setFromName] = useState(client?.fromName || "");
  const [active, setActive] = useState(client?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const recipientList = recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      setError("At least one recipient email is required");
      return;
    }

    setSaving(true);

    try {
      const data = {
        name: name.trim(),
        domain: domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
        recipients: recipientList,
        apiKey,
        fromName: fromName.trim() || null,
        active,
      };

      if (isEditing) {
        await updateDoc(doc(db, "clients", client.id), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "clients"), data);
      }

      onSaved();
    } catch (err) {
      setError("Failed to save client");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-navy-800/50 px-4 py-2.5 text-white placeholder-white/30 focus:border-electric-500 focus:outline-none";

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">
        {isEditing ? "Edit Client" : "Add Client"}
      </h1>

      <div className="service-card rounded-2xl p-[1px]">
        <div className="service-card-inner bg-navy-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="KC360 Gym"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                placeholder="kc360gym.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">
                Recipient Emails{" "}
                <span className="text-white/40">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                required
                placeholder="tim@kc360gym.com, info@kc360gym.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">
                From Name{" "}
                <span className="text-white/40">(optional, defaults to client name)</span>
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Website Contact"
                className={inputClass}
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-white/70 mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiKey}
                  readOnly
                  className={`${inputClass} font-mono text-sm flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !isEditing ||
                      confirm("Regenerate API key? The old key will stop working.")
                    ) {
                      setApiKey(generateApiKey());
                    }
                  }}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/60 hover:text-white hover:border-white/40 transition-colors whitespace-nowrap"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(apiKey)}
                  className="rounded-lg border border-electric-500/40 px-3 py-2 text-xs text-electric-500 hover:bg-electric-500/10 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  active ? "bg-electric-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    active ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-white/70">
                {active ? "Active" : "Inactive"}
              </span>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg border-2 border-electric-500 px-4 py-2.5 text-electric-500 font-medium hover:bg-electric-500 hover:text-navy-900 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : isEditing ? "Update Client" : "Add Client"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-white/60 hover:text-white hover:border-white/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
