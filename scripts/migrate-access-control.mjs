import admin from "firebase-admin";

const apply = process.argv.includes("--apply");
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = admin.firestore();
const employeeSnapshot = await db.collection("employees").get();
const employees = new Map(employeeSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const invalidEmployees = [...employees.entries()].filter(([, data]) =>
  !["employee", "owner"].includes(data.role) || typeof data.locationId !== "string" || !data.locationId.trim()
);

if (invalidEmployees.length) {
  throw new Error(`Първо задайте role и locationId на employees: ${invalidEmployees.map(([uid]) => uid).join(", ")}`);
}

const collectionNames = ["clients", "vehicles", "policies", "installments", "auditLogs"];
const snapshots = Object.fromEntries(await Promise.all(collectionNames.map(async (name) => [name, await db.collection(name).get()])));
const clients = new Map(snapshots.clients.docs.map((doc) => [doc.id, doc.data()]));
const changes = [];
const errors = [];

for (const collection of collectionNames) {
  for (const doc of snapshots[collection].docs) {
    const data = doc.data();
    const linkedClient = collection === "vehicles" ? clients.get(data.clientId) : undefined;
    const employeeId = data.employeeId ?? data.createdBy ?? data.actorUid ?? linkedClient?.employeeId ?? linkedClient?.createdBy;
    const employee = employees.get(employeeId);
    if (!employee) {
      errors.push(`${collection}/${doc.id}: не може да се определи employeeId`);
      continue;
    }

    const update = {
      locationId: employee.locationId,
      employeeId,
      createdBy: data.createdBy ?? employeeId,
    };
    if (collection === "clients" && !data.phoneNormalized && data.normalizedPhone) {
      update.phoneNormalized = data.normalizedPhone;
    }
    if (collection === "policies" && !data.policyNumberNormalized && data.normalizedPolicyNumber) {
      update.policyNumberNormalized = data.normalizedPolicyNumber;
    }
    if (Object.entries(update).some(([key, value]) => data[key] !== value)) {
      changes.push({ ref: doc.ref, update });
    }
  }
}

if (errors.length) throw new Error(`Миграцията е спряна:\n${errors.join("\n")}`);
console.log(`${apply ? "Ще бъдат" : "Биха били"} обновени ${changes.length} записа.`);

if (apply) {
  for (let offset = 0; offset < changes.length; offset += 400) {
    const batch = db.batch();
    for (const change of changes.slice(offset, offset + 400)) batch.update(change.ref, change.update);
    await batch.commit();
  }
  console.log("Access-control миграцията завърши успешно.");
} else {
  console.log("Това беше dry run. Добавете --apply за запис във Firestore.");
}
