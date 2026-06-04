import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { startRoulette, stopRoulette } from './roulette.js';

const db = getDatabase();
const functions = getFunctions();

let selectedSourceId = null;
let selectedTargetId = null;
let currentChance = 0.3;

export async function renderUpgrade(container) {
    const uid = auth.currentUser.uid;
    const invSnap = await get(child(ref(db), `users/${uid}/inventory`));
    const inv = invSnap.val() || {};
    const itemsSnap = await get(ref(db, 'items'));
    const allItems = itemsSnap.val() || {};

    container.innerHTML = `
        <h2>Улучшение скина</h2>
        <div class="card">
            <h3>1. Выберите исходный предмет</h3>
            <select id="source-select">
                <option value="">-- выбрать --</option>
                ${Object.entries(inv).map(([id, item]) => `<option value="${id}">${item.name} ($${item.price})</option>`).join('')}
            </select>
            <div id="source-preview"></div>
        </div>
        <div class="card" id="chance-card" style="display:none">
            <h3>2. Выберите шанс</h3>
            <button class="chance-btn" data-chance="0.03">3%</button>
            <button class="chance-btn" data-chance="0.05">5%</button>
            <button class="chance-btn" data-chance="0.10">10%</button>
            <button class="chance-btn" data-chance="0.30">30%</button>
            <button class="chance-btn" data-chance="0.50">2x (50%)</button>
            <p>Или выберите целевой предмет вручную:</p>
            <select id="target-manual"><option value="">автоподбор...</option></select>
            <p>Целевой предмет: <span id="target-info"></span></p>
            <p>Фактический шанс: <span id="actual-chance">30%</span></p>
        </div>
        <div class="card" id="upgrade-action" style="display:none">
            <div id="roulette-container"></div>
            <button id="start-upgrade">Запустить улучшение</button>
        </div>
    `;

    const sourceSelect = document.getElementById('source-select');
    const chanceCard = document.getElementById('chance-card');
    const targetManual = document.getElementById('target-manual');
    const targetInfo = document.getElementById('target-info');
    const actualChance = document.getElementById('actual-chance');

    sourceSelect.onchange = () => {
        selectedSourceId = sourceSelect.value;
        if (!selectedSourceId) return;
        const sourceItem = inv[selectedSourceId];
        document.getElementById('source-preview').innerHTML = `<img src="${sourceItem.image}" height="80"> ${sourceItem.name} $${sourceItem.price}`;
        chanceCard.style.display = 'block';
        document.getElementById('upgrade-action').style.display = 'block';
        updateAutoTarget(sourceItem.price);
    };

    function updateAutoTarget(sourcePrice) {
        targetManual.innerHTML = '<option value="">автоподбор...</option>';
        // Для каждой кнопки шанса покажем диапазон
        const targets = {};
        for (let [id, item] of Object.entries(allItems)) {
            if (id === selectedSourceId) continue;
            const ratio = sourcePrice / item.price;
            if (ratio >= 0.25 && ratio <= 0.55) targets[id] = item; // для 2x
        }
        // Упрощённо: просто даём выбор любого предмета дороже
        Object.entries(allItems).forEach(([id, item]) => {
            if (item.price > sourcePrice) {
                targetManual.innerHTML += `<option value="${id}">${item.name} ($${item.price})</option>`;
            }
        });
        targetManual.onchange = () => {
            selectedTargetId = targetManual.value;
            if (selectedTargetId) {
                const targetItem = allItems[selectedTargetId];
                const calcChance = sourcePrice / targetItem.price;
                currentChance = Math.min(calcChance, 0.99);
                actualChance.textContent = (currentChance * 100).toFixed(1) + '%';
                targetInfo.textContent = targetItem.name;
            } else {
                // Вернуть автоподбор по кнопкам
            }
        };
    }

    document.querySelectorAll('.chance-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chance = parseFloat(btn.dataset.chance);
            const sourcePrice = inv[selectedSourceId].price;
            // Найти подходящий предмет по диапазону
            const targetPrice = sourcePrice / chance;
            const candidates = Object.entries(allItems)
                .filter(([id, item]) => item.price >= targetPrice * 0.9 && item.price <= targetPrice * 1.1 && id !== selectedSourceId)
                .sort((a,b) => Math.abs(a[1].price - targetPrice) - Math.abs(b[1].price - targetPrice));
            if (candidates.length > 0) {
                selectedTargetId = candidates[0][0];
                const item = candidates[0][1];
                targetInfo.textContent = item.name;
                actualChance.textContent = (chance * 100).toFixed(0) + '%';
                targetManual.value = selectedTargetId;
                currentChance = chance;
            } else {
                showToast('Нет подходящего предмета', true);
            }
        });
    });

    document.getElementById('start-upgrade').onclick = async () => {
        if (!selectedSourceId || !selectedTargetId) return showToast('Выберите предметы', true);
        const sourceItem = inv[selectedSourceId];
        const targetItem = allItems[selectedTargetId];
        // Запускаем рулетку
        startRoulette(currentChance, document.getElementById('roulette-container'));
        const performUpgrade = httpsCallable(functions, 'performUpgrade');
        try {
            const result = await performUpgrade({
                sourceCsfloatId: selectedSourceId,
                targetCsfloatId: selectedTargetId,
                chanceMode: 'custom', // или 'fixed', но мы передаём вычисленный шанс
                chance: currentChance
            });
            const { win } = result.data;
            await stopRoulette(win, currentChance);
            if (win) {
                showToast('Победа! Предмет улучшен.');
            } else {
                showToast('Поражение...');
            }
            // Обновить инвентарь
            location.hash = '#/inventory';
            location.hash = '#/upgrade'; // force re-render
        } catch (e) {
            showToast(e.message, true);
        }
    };
}