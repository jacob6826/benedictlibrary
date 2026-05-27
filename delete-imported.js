import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC00cozPIkJ13Hw-z8QCmdeyF-e6x2d8CQ",
  authDomain: "benedict-library.firebaseapp.com",
  projectId: "benedict-library",
  storageBucket: "benedict-library.firebasestorage.app",
  messagingSenderId: "988999442452",
  appId: "1:988999442452:web:239225d7b059eb2d6f0701"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const q = query(collection(db, "books"), where("location", "==", "Imported"));
const querySnapshot = await getDocs(q);

console.log(`Found ${querySnapshot.size} imported books. Deleting...`);
for (const document of querySnapshot.docs) {
  await deleteDoc(doc(db, "books", document.id));
  console.log(`Deleted: ${document.data().title}`);
}
console.log("All previously imported books have been deleted successfully!");
process.exit(0);
