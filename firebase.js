import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc,
  collection, query, where, addDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAK-Wjhl6NEAEf8RQDvUvcP-lcIUryl2eE",
  authDomain: "mensa-2f888.firebaseapp.com",
  projectId: "mensa-2f888",
  storageBucket: "mensa-2f888.firebasestorage.app",
  messagingSenderId: "787827341002",
  appId: "1:787827341002:web:ca08bab171dced6e87e633",
  measurementId: "G-7V627YR8BK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { onAuthStateChanged };

// Auth helpers
export const registerAuth = (e, p) => createUserWithEmailAndPassword(auth, e, p);
export const loginAuth = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const logoutAuth = () => signOut(auth);

// Users
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), { ...data, uid, createdAt: Date.now() });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function listenToUserProfile(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (doc) => {
    if(doc.exists()) callback(doc.data());
  });
}

export async function updateUserDevice(uid, deviceId) {
  await updateDoc(doc(db, "users", uid), { deviceId });
}

export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, "users", uid));
}

export async function updateUserRole(uid, role) {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function resetUserDevice(uid) {
  await updateDoc(doc(db, "users", uid), { deviceId: null });
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => d.data());
}

export async function updateUserGrades(uid, grades) {
  await updateDoc(doc(db, "users", uid), { grades });
}

export async function updateUserField(uid, field, value) {
  await updateDoc(doc(db, "users", uid), { [field]: value });
}

// Courses
export async function createCourse(data) {
  return await addDoc(collection(db, "courses"), { ...data, createdAt: Date.now() });
}

export async function updateCourse(id, data) {
  await updateDoc(doc(db, "courses", id), data);
}

export async function deleteCourse(id) {
  await deleteDoc(doc(db, "courses", id));
}

export async function getCourses() {
  const snap = await getDocs(collection(db, "courses"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Storage Alternative (Base64 Compression to avoid Firebase Storage Visa requirement)
export async function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error("يرجى اختيار ملف صورة صحيح (JPG, PNG). بالنسبة للملفات يرجى استخدام روابط جوجل درايف."));
      return;
    }

    if (onProgress) onProgress(10); // Start processing

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        if (onProgress) onProgress(50); // Processing image
        
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Max dimensions to keep Base64 size very small (< 100KB)
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG with 0.6 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        
        if (onProgress) onProgress(100); // Done
        resolve(dataUrl);
      };
      img.onerror = (error) => {
        reject(new Error("حدث خطأ أثناء معالجة الصورة."));
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

// Standalone Quizzes
export async function createQuiz(data) {
  return await addDoc(collection(db, "quizzes"), { ...data, createdAt: Date.now() });
}

export async function getQuizzes() {
  const snap = await getDocs(collection(db, "quizzes"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteQuiz(id) {
  await deleteDoc(doc(db, "quizzes", id));
}

// Notifications
export async function createNotification(data) {
  return await addDoc(collection(db, "notifications"), { ...data, createdAt: Date.now() });
}

export async function getNotifications() {
  const snap = await getDocs(collection(db, "notifications"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
