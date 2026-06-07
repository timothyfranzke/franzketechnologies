import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    try {
      return cert(JSON.parse(json));
    } catch (err) {
      console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON:', err.message);
    }
  }
  try {
    return applicationDefault();
  } catch {
    return null;
  }
}

let adminDbInstance = null;
let initFailed = false;

function getAdminDb() {
  if (adminDbInstance) return adminDbInstance;
  if (initFailed) return null;
  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: loadCredential() || undefined,
          projectId:
            process.env.FIREBASE_PROJECT_ID ||
            process.env.PUBLIC_FIREBASE_PROJECT_ID ||
            'franzke-creative',
        });
    adminDbInstance = getFirestore(app);
    return adminDbInstance;
  } catch (err) {
    console.error('firebase-admin init failed (OG will fall back to generic):', err.message);
    initFailed = true;
    return null;
  }
}

function normalizeFamily(f) {
  if (!f) return null;
  const joinedAt =
    f.joinedAt && typeof f.joinedAt.toMillis === 'function'
      ? f.joinedAt.toMillis()
      : f.joinedAt?._seconds
      ? f.joinedAt._seconds * 1000
      : 0;
  return { id: f.id, name: f.name, joinedAtMs: joinedAt };
}

export async function getTripSummary(code) {
  if (!code) return null;
  const clean = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) return null;

  const adminDb = getAdminDb();
  if (!adminDb) return null;

  try {
    const tripSnap = await adminDb.collection('trips').doc(clean).get();
    if (!tripSnap.exists) return null;
    const data = tripSnap.data();

    const families = (data.families || []).map(normalizeFamily).filter(Boolean);

    const expensesSnap = await adminDb
      .collection('trips')
      .doc(clean)
      .collection('expenses')
      .select('amountCents', 'paidByFamilyId')
      .get();

    const expenses = expensesSnap.docs.map((d) => {
      const e = d.data();
      return {
        amountCents: Number(e.amountCents) || 0,
        paidByFamilyId: e.paidByFamilyId,
      };
    });

    return {
      code: clean,
      name: data.name || '',
      families,
      expenses,
      expenseCount: expenses.length,
    };
  } catch (err) {
    console.error('getTripSummary failed:', err);
    return null;
  }
}
