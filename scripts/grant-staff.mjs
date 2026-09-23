import admin from "firebase-admin";

const email = process.argv[2];
const locationId = process.argv[3];
const role = process.argv[4] ?? "employee";
if (!email || !locationId || !["employee", "owner"].includes(role)) {
  console.error("Употреба: npm run grant:staff -- user@example.com location-id [employee|owner]");
  process.exit(1);
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, {
  ...(user.customClaims ?? {}),
  staff: true,
});

await admin.firestore().collection("employees").doc(user.uid).set(
  {
    uid: user.uid,
    email: user.email,
    active: true,
    role,
    locationId,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
);

console.log(`Готово: ${email} е активиран като ${role} в ${locationId}.`);
