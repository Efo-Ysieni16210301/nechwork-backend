import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string,
) as ServiceAccount;

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();

async function setAdmin(email: string) {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`✅ ${email} is now an admin.`);
}

const emailToPromote = process.argv[2];

if (!emailToPromote) {
  console.error("Usage: npx tsx src/scripts/setAdmin.ts your@email.com");
  process.exit(1);
}

setAdmin(emailToPromote).then(() => process.exit(0));
