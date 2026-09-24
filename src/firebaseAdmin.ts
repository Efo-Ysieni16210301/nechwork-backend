import { initializeApp, cert } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required");
}

const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

initializeApp({
  credential: cert(serviceAccount),
});

export const adminAuth = getAuth();
