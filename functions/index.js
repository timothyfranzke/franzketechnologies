import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";

initializeApp();
const db = getFirestore();
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

const RATE_LIMIT = 50; // emails per hour
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Look up a client by origin and validate their API key.
 * Returns the client doc data if valid, or null.
 */
async function validateClient(origin, apiKey) {
  if (!origin || !apiKey) return null;

  // Strip protocol to match stored domain
  const domain = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const snapshot = await db
    .collection("clients")
    .where("domain", "==", domain)
    .where("apiKey", "==", apiKey)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Check and increment rate limit for a client.
 * Uses an atomic Firestore transaction.
 * Returns true if within limit, false if exceeded.
 */
async function checkRateLimit(clientId) {
  const ref = db.collection("rateLimits").doc(clientId);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data();

    if (!data || now - data.windowStart > RATE_WINDOW_MS) {
      // Start a new window
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }

    if (data.count >= RATE_LIMIT) {
      return false;
    }

    tx.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
}

export const sendEmail = onRequest(
  { secrets: [RESEND_API_KEY], cors: false },
  async (req, res) => {
    // --- CORS preflight ---
    const origin = req.headers.origin || "";

    // Build allowed origins from Firestore clients
    if (req.method === "OPTIONS") {
      const clientsSnap = await db
        .collection("clients")
        .where("active", "==", true)
        .get();

      const allowedOrigins = new Set();
      clientsSnap.forEach((doc) => {
        const domain = doc.data().domain;
        allowedOrigins.add(`https://${domain}`);
        allowedOrigins.add(`http://${domain}`);
      });

      if (allowedOrigins.has(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
        res.set("Access-Control-Max-Age", "3600");
        return res.status(204).send("");
      }

      return res.status(403).json({ error: "Forbidden" });
    }

    // --- Only POST allowed ---
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // --- Validate client ---
    const apiKey = req.headers["x-api-key"];
    const client = await validateClient(origin, apiKey);

    if (!client) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Set CORS header for the actual request
    res.set("Access-Control-Allow-Origin", origin);

    // --- Rate limit ---
    const withinLimit = await checkRateLimit(client.id);
    if (!withinLimit) {
      return res.status(429).json({ error: "Too many requests" });
    }

    // --- Validate body ---
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields: name, email, message" });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // --- Send email via Resend ---
    try {
      const resend = new Resend(RESEND_API_KEY.value());
      const fromName = client.fromName || client.name;

      await resend.emails.send({
        from: `${fromName} <noreply@franzketechnologies.com>`,
        to: client.recipients,
        replyTo: email,
        subject: `New Contact Form Submission — ${client.name}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          ``,
          `Message:`,
          message,
        ].join("\n"),
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Resend error:", err);
      return res.status(500).json({ error: "Failed to send email" });
    }
  }
);
