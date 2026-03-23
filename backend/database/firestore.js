import admin from "firebase-admin";
import { env } from "../server/config.js";

let db;

export async function initializeFirestore() {
  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.projectId,
      clientEmail: env.clientEmail,
      privateKey: env.privateKey
    })
  });

  db = admin.firestore();
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Firestore has not been initialized");
  }

  return db;
}
