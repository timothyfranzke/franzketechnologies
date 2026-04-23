import React, { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase.js";
import ClientForm from "./ClientForm.jsx";

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list view, "new" = add, or client object
  const [revealedKeys, setRevealedKeys] = useState(new Set());

  async function fetchClients() {
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, "clients"), orderBy("name"))
    );
    setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
  }, []);

  async function toggleActive(client) {
    await updateDoc(doc(db, "clients", client.id), {
      active: !client.active,
    });
    fetchClients();
  }

  async function handleDelete(client) {
    if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "clients", client.id));
    fetchClients();
  }

  function toggleKeyVisibility(id) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyKey(apiKey) {
    navigator.clipboard.writeText(apiKey);
  }

  function handleSaved() {
    setEditing(null);
    fetchClients();
  }

  if (editing !== null) {
    return (
      <ClientForm
        client={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Email Proxy Clients</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg border-2 border-electric-500 px-4 py-2 text-sm text-electric-500 font-medium hover:bg-electric-500 hover:text-navy-900 transition-colors"
          >
            + Add Client
          </button>
          <button
            onClick={() => signOut(auth)}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/60 hover:text-white hover:border-white/40 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Client table */}
      {loading ? (
        <p className="text-white/60">Loading clients...</p>
      ) : clients.length === 0 ? (
        <div className="service-card rounded-2xl p-[1px]">
          <div className="service-card-inner bg-navy-800 rounded-2xl p-12 text-center">
            <p className="text-white/60">No clients yet. Add one to get started.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.id} className="service-card rounded-xl p-[1px]">
              <div className="service-card-inner bg-navy-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold truncate">{client.name}</h2>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          client.active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {client.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-white/50 mt-1">{client.domain}</p>
                    <p className="text-sm text-white/40 mt-1">
                      {client.recipients?.join(", ")}
                    </p>

                    {/* API Key row */}
                    <div className="flex items-center gap-2 mt-3">
                      <code className="text-xs bg-navy-900/50 px-2 py-1 rounded font-mono text-white/60">
                        {revealedKeys.has(client.id)
                          ? client.apiKey
                          : client.apiKey?.substring(0, 6) + "..."}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(client.id)}
                        className="text-xs text-white/40 hover:text-white/70"
                      >
                        {revealedKeys.has(client.id) ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => copyKey(client.apiKey)}
                        className="text-xs text-electric-500/70 hover:text-electric-500"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(client)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        client.active
                          ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                          : "border-green-500/40 text-green-400 hover:bg-green-500/10"
                      }`}
                    >
                      {client.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => setEditing(client)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(client)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400/70 hover:text-red-400 hover:border-red-500/50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
