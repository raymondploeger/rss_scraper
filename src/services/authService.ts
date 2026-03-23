import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

const saveUserProfile = async (user: User) => {
  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const authService = {
  async register(email: string, password: string) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserProfile(credential.user);
    return credential.user;
  },

  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  async loginWithGoogle() {
    const credential = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(credential.user);
    return credential.user;
  },

  async logout() {
    await signOut(auth);
  },
};
