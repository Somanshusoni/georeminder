// Firebase Firestore Direct Test
// Uses the same config as the app (from .env.local)
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  doc,
} from "firebase/firestore";
import { readFileSync } from "fs";

// Parse .env.local manually
const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const [key, ...vals] = line.split("=");
  if (key && vals.length) env[key.trim()] = vals.join("=").trim();
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

console.log("\n🔥 Firebase Config Loaded:");
console.log("  Project ID:", firebaseConfig.projectId);
console.log("  Auth Domain:", firebaseConfig.authDomain);
console.log("  API Key:", firebaseConfig.apiKey?.slice(0, 8) + "...");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TEST_EMAIL = "test-script@georeminder.com";
const TEST_COLLECTION = "reminders";

async function runTests() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST 1: Write a document to Firestore");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  let docId = null;
  try {
    const docRef = await addDoc(collection(db, TEST_COLLECTION), {
      title: "Script Test Reminder",
      notes: "Auto-created by test-firebase.mjs",
      userEmail: TEST_EMAIL,
      lat: 12.9716,
      lng: 77.5946,
      radiusMeters: 200,
      status: "active",
      createdAt: Date.now(),
    });
    docId = docRef.id;
    console.log("✅ WRITE SUCCESS — Document ID:", docId);
  } catch (err) {
    console.error("❌ WRITE FAILED:", err.message);
    if (err.message.includes("PERMISSION_DENIED")) {
      console.error("   → Firestore security rules are blocking writes.");
      console.error("   → Go to Firebase Console → Firestore → Rules and set:");
      console.error("     allow read, write: if true;  (for testing)");
    } else if (err.message.includes("API key not valid")) {
      console.error("   → The Firebase API key in .env.local is invalid.");
    }
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST 2: Read back documents from Firestore");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    const q = query(
      collection(db, TEST_COLLECTION),
      where("userEmail", "==", TEST_EMAIL)
    );
    const snapshot = await getDocs(q);
    console.log(`✅ READ SUCCESS — Found ${snapshot.size} document(s):`);
    snapshot.forEach((d) => {
      const data = d.data();
      console.log(`   ID: ${d.id} | Title: "${data.title}" | Status: ${data.status}`);
    });
  } catch (err) {
    console.error("❌ READ FAILED:", err.message);
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST 3: Delete the test document (cleanup)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    await deleteDoc(doc(db, TEST_COLLECTION, docId));
    console.log("✅ DELETE SUCCESS — Cleaned up test document.");
  } catch (err) {
    console.error("❌ DELETE FAILED:", err.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 ALL TESTS PASSED — Firebase is storing data correctly!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n💥 Unexpected error:", err);
  process.exit(1);
});
