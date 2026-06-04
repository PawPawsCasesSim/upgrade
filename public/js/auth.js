import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const auth = getAuth();
const db = getDatabase();

export function renderAuth(container) {
    container.innerHTML = `
        <div class="card" style="max-width:400px;margin:2rem auto;">
            <h2>Вход / Регистрация</h2>
            <input type="email" id="email" placeholder="Email">
            <input type="password" id="password" placeholder="Пароль">
            <button id="login-btn">Войти</button>
            <button id="register-btn" class="secondary">Зарегистрироваться</button>
        </div>
    `;
    document.getElementById('login-btn').onclick = () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        signInWithEmailAndPassword(auth, email, pass).catch(e => showToast(e.message, true));
    };
    document.getElementById('register-btn').onclick = async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            // Создаём профиль пользователя
            await set(ref(db, `users/${cred.user.uid}`), {
                nickname: email.split('@')[0],
                balance: 0,
                inventory: {},
                stats: { totalUpgrades: 0, wins: 0, losses: 0, biggestWin: 0, biggestLoss: 0 }
            });
            showToast('Аккаунт создан!');
        } catch (e) {
            showToast(e.message, true);
        }
    };
}