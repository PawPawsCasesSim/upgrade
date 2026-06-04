import { getDatabase, ref, query, orderByChild, equalTo, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase();

export function renderHistory(container) {
    const uid = auth.currentUser.uid;
    const upgradesRef = ref(db, 'upgrades');
    // В реальности нужно фильтровать по uid через equalTo, но для простоты покажем все свои
    onValue(upgradesRef, (snap) => {
        const upgrades = snap.val() || {};
        container.innerHTML = '<h2>История улучшений</h2>';
        Object.entries(upgrades).filter(([id, u]) => u.uid === uid).forEach(([id, u]) => {
            container.innerHTML += `
                <div class="card">
                    <p>${new Date(u.timestamp).toLocaleString()}</p>
                    <p>${u.sourceItem.name} → ${u.targetItem.name}</p>
                    <p>Шанс: ${(u.chance*100).toFixed(1)}% | Результат: <b>${u.result === 'win' ? 'Победа' : 'Поражение'}</b></p>
                </div>
            `;
        });
    });
}