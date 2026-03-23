import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore();
export const serverTimestamp = () => FieldValue.serverTimestamp();
export const batch = () => db.batch();
