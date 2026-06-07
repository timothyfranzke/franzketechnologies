import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_CODE_TRIES = 5;

function randomCode() {
  let out = "";
  const arr = new Uint32Array(CODE_LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    for (let i = 0; i < CODE_LENGTH; i++) {
      out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) {
      out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  }
  return out;
}

function randomFamilyId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return "fam_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return "fam_" + Math.random().toString(36).slice(2, 14);
}

function tripRef(code) {
  return doc(db, "trips", code);
}

function expensesRef(code) {
  return collection(db, "trips", code, "expenses");
}

export async function getTrip(code) {
  const snap = await getDoc(tripRef(code));
  if (!snap.exists()) return null;
  return { code: snap.id, ...snap.data() };
}

export async function createTrip({ tripName, familyName }) {
  const cleanName = (tripName || "").trim();
  const cleanFamily = (familyName || "").trim();
  if (!cleanName) throw new Error("Trip name is required.");
  if (!cleanFamily) throw new Error("Family name is required.");

  for (let attempt = 0; attempt < MAX_CODE_TRIES; attempt++) {
    const code = randomCode();
    const existing = await getDoc(tripRef(code));
    if (existing.exists()) continue;

    const familyId = randomFamilyId();
    await setDoc(tripRef(code), {
      code,
      name: cleanName,
      createdAt: serverTimestamp(),
      families: [
        {
          id: familyId,
          name: cleanFamily,
          joinedAt: Timestamp.now(),
        },
      ],
    });
    return { code, tripName: cleanName, familyId, familyName: cleanFamily };
  }
  throw new Error("Couldn't generate a code. Try again.");
}

export async function joinTrip({ code, familyName }) {
  const cleanCode = (code || "").trim().toUpperCase();
  const cleanFamily = (familyName || "").trim();
  if (!cleanCode) throw new Error("Trip code is required.");
  if (!cleanFamily) throw new Error("Family name is required.");

  const snap = await getDoc(tripRef(cleanCode));
  if (!snap.exists()) throw new Error("Trip not found. Check the code.");

  const data = snap.data();
  const families = data.families || [];

  const existing = families.find(
    (f) => f.name.toLowerCase() === cleanFamily.toLowerCase()
  );
  if (existing) {
    // Treat as rejoining the same family — same id, same name.
    return {
      code: cleanCode,
      tripName: data.name,
      familyId: existing.id,
      familyName: existing.name,
      rejoined: true,
    };
  }

  const familyId = randomFamilyId();
  await updateDoc(tripRef(cleanCode), {
    families: arrayUnion({
      id: familyId,
      name: cleanFamily,
      joinedAt: Timestamp.now(),
    }),
  });
  return {
    code: cleanCode,
    tripName: data.name,
    familyId,
    familyName: cleanFamily,
    rejoined: false,
  };
}

export function subscribeTrip(code, onChange, onError) {
  return onSnapshot(
    tripRef(code),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange({ code: snap.id, ...snap.data() });
    },
    (err) => onError && onError(err)
  );
}

export function subscribeExpenses(code, onChange, onError) {
  const q = query(expensesRef(code), orderBy("spentAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(items);
    },
    (err) => onError && onError(err)
  );
}

export async function addExpense(code, expense) {
  const payload = {
    amountCents: expense.amountCents,
    place: expense.place.trim(),
    description: (expense.description || "").trim(),
    spentAt: expense.spentAt instanceof Date ? Timestamp.fromDate(expense.spentAt) : expense.spentAt,
    paidByFamilyId: expense.paidByFamilyId,
    paidByFamilyName: expense.paidByFamilyName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return addDoc(expensesRef(code), payload);
}

export async function updateExpense(code, expenseId, patch) {
  const ref = doc(db, "trips", code, "expenses", expenseId);
  const payload = { ...patch, updatedAt: serverTimestamp() };
  if (payload.spentAt instanceof Date) payload.spentAt = Timestamp.fromDate(payload.spentAt);
  if (typeof payload.place === "string") payload.place = payload.place.trim();
  if (typeof payload.description === "string") payload.description = payload.description.trim();
  return updateDoc(ref, payload);
}

export async function deleteExpense(code, expenseId) {
  const ref = doc(db, "trips", code, "expenses", expenseId);
  return deleteDoc(ref);
}

export function timestampToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}
