const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// ⚠️ ВСТАВЬТЕ СЮДА ВАШ КЛЮЧ ОТ CSFLOAT API
const CSFLOAT_API_KEY = 'csfloat_ваш_ключ_здесь';

admin.initializeApp();

// ============ Загрузка предметов из CSFloat ============
async function fetchAndStoreItems() {
    const db = admin.database();
    let allItems = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        const response = await axios.get('https://csfloat.com/api/v1/listings', {
            headers: { 'Authorization': `Bearer ${CSFLOAT_API_KEY}` },
            params: {
                limit: limit,
                offset: page * limit,
            }
        });
        const items = response.data.data || response.data;
        if (!items || items.length === 0) {
            hasMore = false;
        } else {
            allItems = allItems.concat(items);
            page++;
        }
    }

    const updates = {};
    allItems.forEach(item => {
        const csfloatId = item.id || item.listing_id;
        if (!csfloatId) return;
        updates[csfloatId] = {
            name: item.item_name || item.name,
            image: item.image || item.item_image,
            price: item.price,
            rarity: item.rarity_name || item.rarity,
            weapon: item.weapon_type || item.weapon
        };
    });
    await db.ref('items').set(updates);
    console.log(`Updated items: ${Object.keys(updates).length}`);
}

// ============ Ручной вызов обновления каталога ============
exports.fetchItems = functions.https.onRequest(async (req, res) => {
    try {
        await fetchAndStoreItems();
        res.status(200).send('Items updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching items');
    }
});

// ============ Автоматическое обновление раз в 6 часов ============
exports.scheduledFetchItems = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        await fetchAndStoreItems();
        return null;
    });

// ============ Улучшение (серверная логика) ============
exports.performUpgrade = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
    const uid = context.auth.uid;
    const { sourceCsfloatId, targetCsfloatId, chanceMode, chance } = data;
    const db = admin.database();
    const userRef = db.ref(`users/${uid}`);
    const itemsRef = db.ref('items');

    const [userSnap, sourceItemSnap, targetItemSnap] = await Promise.all([
        userRef.once('value'),
        itemsRef.child(sourceCsfloatId).once('value'),
        itemsRef.child(targetCsfloatId).once('value')
    ]);
    const user = userSnap.val();
    const sourceItem = sourceItemSnap.val();
    const targetItem = targetItemSnap.val();
    if (!user || !sourceItem || !targetItem) throw new functions.https.HttpsError('not-found', 'Предмет не найден');
    if (!user.inventory || !user.inventory[sourceCsfloatId]) throw new functions.https.HttpsError('permission-denied', 'Предмет не в инвентаре');

    const sourcePrice = sourceItem.price;
    const targetPrice = targetItem.price;
    if (sourcePrice <= 0 || targetPrice <= 0) throw new functions.https.HttpsError('invalid-argument', 'Некорректные цены');

    let validChance;
    if (chanceMode === 'fixed') {
        const ratio = targetPrice / sourcePrice;
        let expectedChance;
        if (Math.abs(ratio - 2) <= 0.2) expectedChance = 0.5;
        else if (ratio >= 3 && ratio <= 3.5) expectedChance = 0.3;
        else if (ratio >= 9 && ratio <= 11) expectedChance = 0.1;
        else if (ratio >= 18 && ratio <= 22) expectedChance = 0.05;
        else if (ratio >= 30 && ratio <= 35) expectedChance = 0.03;
        else throw new functions.https.HttpsError('invalid-argument', 'Несоответствие шанса и цены');
        if (Math.abs(chance - expectedChance) > 0.001) throw new functions.https.HttpsError('invalid-argument', 'Шанс не совпадает с фиксированным');
        validChance = chance;
    } else {
        const calculated = sourcePrice / targetPrice;
        if (Math.abs(chance - calculated) > 0.0001) throw new functions.https.HttpsError('invalid-argument', 'Неверный расчёт шанса');
        validChance = calculated;
    }

    const win = Math.random() < validChance;

    await userRef.transaction(currentUser => {
        if (!currentUser || !currentUser.inventory[sourceCsfloatId]) return;
        const updatedInventory = { ...currentUser.inventory };
        delete updatedInventory[sourceCsfloatId];
        if (win) {
            updatedInventory[targetCsfloatId] = {
                csfloatId: targetCsfloatId,
                name: targetItem.name,
                image: targetItem.image,
                price: targetItem.price,
                rarity: targetItem.rarity,
                weapon: targetItem.weapon
            };
        }
        const stats = currentUser.stats || {};
        return {
            ...currentUser,
            inventory: updatedInventory,
            stats: {
                totalUpgrades: (stats.totalUpgrades || 0) + 1,
                wins: (stats.wins || 0) + (win ? 1 : 0),
                losses: (stats.losses || 0) + (win ? 0 : 1),
                biggestWin: win ? Math.max(stats.biggestWin || 0, targetPrice) : (stats.biggestWin || 0),
                biggestLoss: !win ? Math.max(stats.biggestLoss || 0, sourcePrice) : (stats.biggestLoss || 0)
            }
        };
    });

    const upgradeRef = db.ref('upgrades').push();
    await upgradeRef.set({
        uid,
        sourceItem: { id: sourceCsfloatId, name: sourceItem.name, price: sourcePrice },
        targetItem: { id: targetCsfloatId, name: targetItem.name, price: targetPrice },
        chance: validChance,
        result: win ? 'win' : 'loss',
        timestamp: admin.database.ServerValue.TIMESTAMP
    });

    return { win };
});

// ============ Админ: баланс ============
exports.adminSetBalance = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) throw new functions.https.HttpsError('permission-denied', 'Только админ');
    const { targetUid, amount, operation } = data;
    const db = admin.database();
    const userRef = db.ref(`users/${targetUid}`);
    await userRef.transaction(user => {
        if (!user) return;
        const balance = (user.balance || 0) + (operation === 'add' ? amount : -amount);
        if (balance < 0) throw new functions.https.HttpsError('invalid-argument', 'Недостаточно средств');
        return { ...user, balance };
    });
    await db.ref('admin_logs').push().set({
        action: operation === 'add' ? 'balance_add' : 'balance_remove',
        adminUid: context.auth.uid,
        targetUid,
        amount,
        timestamp: admin.database.ServerValue.TIMESTAMP
    });
    return { success: true };
});

// ============ Админ: инвентарь ============
exports.adminManageInventory = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) throw new functions.https.HttpsError('permission-denied', 'Только админ');
    const { targetUid, csfloatId, action } = data;
    const db = admin.database();
    const itemSnap = await db.ref(`items/${csfloatId}`).once('value');
    const item = itemSnap.val();
    if (!item && action === 'add') throw new functions.https.HttpsError('not-found', 'Предмет не найден в каталоге');
    const userRef = db.ref(`users/${targetUid}`);
    await userRef.transaction(user => {
        if (!user) return;
        const inventory = { ...user.inventory };
        if (action === 'add') {
            inventory[csfloatId] = {
                csfloatId,
                name: item.name,
                image: item.image,
                price: item.price,
                rarity: item.rarity,
                weapon: item.weapon
            };
        } else {
            delete inventory[csfloatId];
        }
        return { ...user, inventory };
    });
    await db.ref('admin_logs').push().set({
        action: `inventory_${action}`,
        adminUid: context.auth.uid,
        targetUid,
        csfloatId,
        timestamp: admin.database.ServerValue.TIMESTAMP
    });
    return { success: true };
});