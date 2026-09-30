import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
const firebaseConfig = {
    apiKey: "AIzaSyDummyKey",
    authDomain: "broomies-bakery.firebaseapp.com",
    projectId: "broomies-bakery",
    storageBucket: "broomies-bakery.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
