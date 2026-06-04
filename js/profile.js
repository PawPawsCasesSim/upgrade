import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase();

export function renderProfile(container) {
    const uid = auth.currentUser.uid;
    const userRef = ref(db, `users/${uid}`);
    onValue(userRef, (snap) => {
        const user = snap.val() || {};
        container.innerHTML = `
            <h2>Профиль</h2>
            <div class="card">
                <p>Никнейм: ${user.nickname || '—'}</p>
                <p>Баланс: $${user.balance?.toFixed(2) || '0.00'}</p>
                <p>Побед: ${user.stats?.wins || 0}</p>
                <p>Поражений: ${user.stats?.losses || 0}</p>
                <p>Всего улучшений: ${user.stats?.totalUpgrades || 0}</p>
                <p>Самый дорогой выигрыш: $${user.stats?.biggestWin || 0}</p>
                <p>Самый дорогой проигрыш: $${user.stats?.biggestLoss || 0}</p>
            </div>
        `;
    });
}