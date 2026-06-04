import { getDatabase, ref, onValue, set, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase();

export async function renderInventory(container) {
    const uid = auth.currentUser.uid;
    const invRef = ref(db, `users/${uid}/inventory`);
    onValue(invRef, (snap) => {
        const inv = snap.val() || {};
        container.innerHTML = '<h2>Мой инвентарь</h2><div class="grid" id="inv-grid"></div>';
        const grid = document.getElementById('inv-grid');
        Object.entries(inv).forEach(([id, item]) => {
            grid.innerHTML += `
                <div class="card">
                    <img src="${item.image}" class="item-img">
                    <h3>${item.name}</h3>
                    <p>$${item.price.toFixed(2)}</p>
                    <small>${item.weapon} | ${item.rarity}</small>
                </div>
            `;
        });
    });
}

export async function renderCatalog(container) {
    const itemsRef = ref(db, 'items');
    onValue(itemsRef, (snap) => {
        const items = snap.val() || {};
        const search = `<input type="text" id="search" placeholder="Поиск...">`;
        container.innerHTML = `<h2>Каталог предметов</h2>${search}<div class="grid" id="cat-grid"></div>`;
        const grid = document.getElementById('cat-grid');
        const renderItems = (filter = '') => {
            grid.innerHTML = '';
            Object.entries(items).forEach(([id, item]) => {
                if (filter && !item.name.toLowerCase().includes(filter.toLowerCase())) return;
                grid.innerHTML += `
                    <div class="card">
                        <img src="${item.image}" class="item-img">
                        <h3>${item.name}</h3>
                        <p>$${item.price.toFixed(2)}</p>
                        <small>${item.weapon} | ${item.rarity}</small>
                    </div>
                `;
            });
        };
        renderItems();
        document.getElementById('search').oninput = (e) => renderItems(e.target.value);
    });
}