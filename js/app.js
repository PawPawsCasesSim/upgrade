import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// ⚠️ Замените на данные вашего Firebase-проекта
const firebaseConfig = {
    apiKey: "AIzaSyA43oRwIsxvuli5Rvzdu24HkGS5T6Py1gU",
    authDomain: "upgrade-b63cc.firebaseapp.com",
    databaseURL: "https://upgrade-b63cc-default-rtdb.firebaseio.com",
    projectId: "upgrade-b63cc",
    storageBucket: "upgrade-b63cc.firebasestorage.app",
    messagingSenderId: "128834836161",
    appId: "1:128834836161:web:acad25af194c073b842640"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const functions = getFunctions(app);

window.auth = auth;
window.db = db;
window.functions = functions;

// Роутинг
const routes = {
    '#/auth': renderAuth,
    '#/inventory': renderInventory,
    '#/catalog': renderCatalog,
    '#/upgrade': renderUpgrade,
    '#/history': renderHistory,
    '#/profile': renderProfile,
    '#/admin': renderAdmin
};

function router() {
    const hash = location.hash || '#/auth';
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active-link'));
    const link = document.querySelector(`nav a[href="${hash}"]`);
    if (link) link.classList.add('active-link');
    const appDiv = document.getElementById('app');
    const renderFn = routes[hash] || renderAuth;
    renderFn(appDiv);
}

window.addEventListener('hashchange', router);
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('main-nav').style.display = 'flex';
        document.getElementById('logout-btn').onclick = () => signOut(auth);
        // Проверка, админ ли пользователь
        user.getIdTokenResult().then(token => {
            if (token.claims.admin) {
                document.getElementById('admin-link').style.display = 'inline';
            } else {
                document.getElementById('admin-link').style.display = 'none';
            }
        });
    } else {
        document.getElementById('main-nav').style.display = 'none';
        location.hash = '#/auth';
    }
    router();
});

// Toast уведомления
window.showToast = (msg, error = false) => {
    const toast = document.createElement('div');
    toast.className = `toast ${error ? 'error' : ''}`;
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
};