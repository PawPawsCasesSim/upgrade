import { getDatabase, ref, update, child, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const db = getDatabase();
const functions = getFunctions();

export function renderAdmin(container) {
    container.innerHTML = `
        <h2>Админ-панель</h2>
        <div class="card">
            <h3>Управление балансом</h3>
            <input type="text" id="admin-uid" placeholder="UID пользователя">
            <input type="number" id="amount" placeholder="Сумма">
            <button id="add-balance">Выдать</button>
            <button id="remove-balance">Списать</button>
        </div>
        <div class="card">
            <h3>Добавить предмет пользователю</h3>
            <input type="text" id="admin-item-uid" placeholder="UID">
            <select id="admin-item-select"><option value="">-- предмет --</option></select>
            <button id="add-item">Добавить</button>
            <button id="remove-item">Удалить</button>
        </div>
    `;

    // Загружаем список предметов для выбора
    const itemsRef = ref(db, 'items');
    get(itemsRef).then(snap => {
        const items = snap.val() || {};
        const select = document.getElementById('admin-item-select');
        Object.entries(items).forEach(([id, item]) => {
            select.innerHTML += `<option value="${id}">${item.name}</option>`;
        });
    });

    document.getElementById('add-balance').onclick = async () => {
        const uid = document.getElementById('admin-uid').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const fn = httpsCallable(functions, 'adminSetBalance');
        await fn({ targetUid: uid, amount, operation: 'add' });
        showToast('Баланс обновлён');
    };
    document.getElementById('remove-balance').onclick = async () => {
        const uid = document.getElementById('admin-uid').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const fn = httpsCallable(functions, 'adminSetBalance');
        await fn({ targetUid: uid, amount, operation: 'remove' });
        showToast('Баланс обновлён');
    };
    // Аналогично для add/remove предмета через adminManageInventory
}