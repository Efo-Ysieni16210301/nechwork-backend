import { initializeApp, cert } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string,
) as ServiceAccount;

initializeApp({
  credential: cert(serviceAccount),
});

export const adminAuth = getAuth();
