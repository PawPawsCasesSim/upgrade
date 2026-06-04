export function startRoulette(chance, container) {
    container.innerHTML = `
        <div class="roulette-container" style="--chance:${chance}">
            <div class="roulette-circle"></div>
            <div class="arrow" id="roulette-arrow"></div>
        </div>
    `;
    const arrow = document.getElementById('roulette-arrow');
    arrow.style.transition = 'none';
    arrow.style.transform = 'translate(-50%, -100%) rotate(0deg)';
    // Начинаем вращение через RAF
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            arrow.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
            arrow.style.transform = `translate(-50%, -100%) rotate(${360 * 5}deg)`; // 5 оборотов + финальный угол
        });
    });
}

export function stopRoulette(win, chance) {
    return new Promise(resolve => {
        const arrow = document.getElementById('roulette-arrow');
        // Вычисляем конечный угол в зависимости от результата
        const greenSector = chance * 360; // в градусах
        let targetAngle;
        if (win) {
            // Остановиться в зелёном секторе
            targetAngle = Math.random() * greenSector;
        } else {
            // Остановиться в красном секторе
            targetAngle = greenSector + Math.random() * (360 - greenSector);
        }
        // Прибавляем 5 полных оборотов (1800 градусов) + доворот
        const fullRotations = 1800;
        const finalAngle = fullRotations + targetAngle;
        arrow.style.transform = `translate(-50%, -100%) rotate(${finalAngle}deg)`;
        setTimeout(resolve, 4000); // ждём окончания анимации
    });
}