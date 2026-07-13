// ─── Configuração Firebase ────────────────────────────────────────────────
import { initializeApp }             from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }                   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }              from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage }                from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBi2oNzK5f1d3wNv9ar4vbjQDcT4R7aphQ",
  authDomain:        "cief-ipora.firebaseapp.com",
  projectId:         "cief-ipora",
  storageBucket:     "cief-ipora.firebasestorage.app",
  messagingSenderId: "347411516521",
  appId:             "1:347411516521:web:233a88fb8d5d1918a626f8",
  measurementId:     "G-DDQ3G7HC07"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const storage  = getStorage(app);

export { auth, db, storage };
