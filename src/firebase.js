import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const booksCol = collection(db, 'books')

export async function loadBooks() {
  const snap = await getDocs(booksCol)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveBook(book) {
  const id = book.id || book.title
  await setDoc(doc(db, 'books', id), { ...book, id })
}

export async function removeBook(id) {
  await deleteDoc(doc(db, 'books', id))
}
