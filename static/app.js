const state = {
    n: 5,
    mode: 'start',
    grid: [],
    arrows: {},
    values: {},
    stepReward: -1,
    gamma: 0.9,
};

const gridElement = document.getElementById('grid');
const messageElement = document.getElementById('message');
const currentNElement = document.getElementById('currentN');
const startCountElement = document.getElementById('startCount');
const endCountElement = document.getElementById('endCount');
const obstacleCountElement = document.getElementById('obstacleCount');
const obstacleTargetElement = document.getElementById('obstacleTarget');
const currentModeLabelElement = document.getElementById('currentModeLabel');
const currentRewardElement = document.getElementById('currentReward');
const currentGammaElement = document.getElementById('currentGamma');
const rewardInput = document.getElementById('stepReward');
const gammaInput = document.getElementById('gamma');

const modeLabelMap = {
    start: '起點',
    end: '終點',
    obstacle: '障礙物',
    erase: '清除格子',
};

function createEmptyGrid(n) {
    return Array.from({ length: n }, () => Array.from({ length: n }, () => 'empty'));
}

function setMessage(text, isError = false) {
    messageElement.textContent = text;
    messageElement.style.background = isError ? '#fef2f2' : '#eff6ff';
    messageElement.style.color = isError ? '#b91c1c' : '#1d4ed8';
    messageElement.style.borderColor = isError ? '#fecaca' : '#bfdbfe';
}

function getCounts() {
    let start = 0;
    let end = 0;
    let obstacle = 0;

    for (const row of state.grid) {
        for (const cell of row) {
            if (cell === 'start') start += 1;
            if (cell === 'end') end += 1;
            if (cell === 'obstacle') obstacle += 1;
        }
    }

    return { start, end, obstacle };
}

function syncParametersFromInputs() {
    state.stepReward = Number(rewardInput.value);
    state.gamma = Number(gammaInput.value);
}

function updateStatus() {
    const counts = getCounts();
    syncParametersFromInputs();
    currentNElement.textContent = state.n;
    startCountElement.textContent = counts.start;
    endCountElement.textContent = counts.end;
    obstacleCountElement.textContent = counts.obstacle;
    obstacleTargetElement.textContent = state.n - 2;
    currentRewardElement.textContent = state.stepReward;
    currentGammaElement.textContent = state.gamma;
    currentModeLabelElement.textContent = modeLabelMap[state.mode];
}

function clearComputedResults() {
    state.arrows = {};
    state.values = {};
}

function formatValue(cellType, key) {
    if (cellType === 'obstacle') return '';
    if (cellType === 'end') return 'V=0.00';
    if (state.values[key] === undefined) return '';
    return `V=${Number(state.values[key]).toFixed(2)}`;
}

function formatCenterLabel(cellType, key) {
    if (cellType === 'start') return 'S';
    if (cellType === 'end') return 'G';
    if (cellType === 'obstacle') return 'X';
    return state.arrows[key] || '';
}

function renderGrid() {
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${state.n}, minmax(72px, 1fr))`;

    for (let r = 0; r < state.n; r += 1) {
        for (let c = 0; c < state.n; c += 1) {
            const key = `${r},${c}`;
            const cellType = state.grid[r][c];
            const cell = document.createElement('div');
            cell.className = `cell ${cellType}`;
            cell.dataset.row = r;
            cell.dataset.col = c;

            const label = document.createElement('div');
            label.className = 'cell-label';
            label.textContent = `(${r},${c})`;

            const arrow = document.createElement('div');
            arrow.className = 'arrow';
            arrow.textContent = formatCenterLabel(cellType, key);

            const value = document.createElement('div');
            value.className = 'value';
            value.textContent = formatValue(cellType, key);

            cell.appendChild(label);
            cell.appendChild(arrow);
            cell.appendChild(value);
            cell.addEventListener('click', () => handleCellClick(r, c));
            gridElement.appendChild(cell);
        }
    }

    updateStatus();
}

function clearExisting(type) {
    for (let r = 0; r < state.n; r += 1) {
        for (let c = 0; c < state.n; c += 1) {
            if (state.grid[r][c] === type) {
                state.grid[r][c] = 'empty';
            }
        }
    }
}

function handleCellClick(r, c) {
    clearComputedResults();
    const current = state.grid[r][c];
    const counts = getCounts();

    if (state.mode === 'erase') {
        state.grid[r][c] = 'empty';
        renderGrid();
        setMessage(`已清除格子 (${r}, ${c})。`);
        return;
    }

    if (state.mode === 'start') {
        clearExisting('start');
        state.grid[r][c] = 'start';
        renderGrid();
        setMessage(`已將 (${r}, ${c}) 設定為起點。`);
        return;
    }

    if (state.mode === 'end') {
        clearExisting('end');
        state.grid[r][c] = 'end';
        renderGrid();
        setMessage(`已將 (${r}, ${c}) 設定為終點。`);
        return;
    }

    if (state.mode === 'obstacle') {
        if (current === 'obstacle') {
            state.grid[r][c] = 'empty';
            renderGrid();
            setMessage(`已移除障礙物 (${r}, ${c})。`);
            return;
        }

        if (counts.obstacle >= state.n - 2) {
            setMessage(`障礙物最多只能設定 ${state.n - 2} 個。`, true);
            return;
        }

        state.grid[r][c] = 'obstacle';
        renderGrid();
        setMessage(`已將 (${r}, ${c}) 設定為障礙物。`);
    }
}

async function evaluatePolicy() {
    try {
        syncParametersFromInputs();
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                n: state.n,
                grid: state.grid,
                step_reward: state.stepReward,
                gamma: state.gamma,
            }),
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
            throw new Error(result.message || '評估失敗');
        }

        state.arrows = result.arrows;
        state.values = result.values;
        renderGrid();
        setMessage(result.message);
    } catch (error) {
        setMessage(error.message, true);
    }
}

function initializeGrid() {
    state.n = Number(document.getElementById('gridSize').value);
    state.grid = createEmptyGrid(state.n);
    clearComputedResults();
    renderGrid();
    setMessage(`已建立 ${state.n} x ${state.n} 網格，請開始設定起點、終點與障礙物。`);
}

function clearGridSettings() {
    state.grid = createEmptyGrid(state.n);
    clearComputedResults();
    renderGrid();
    setMessage('已清空所有設定。');
}

document.getElementById('createGridBtn').addEventListener('click', initializeGrid);
document.getElementById('clearBtn').addEventListener('click', clearGridSettings);
document.getElementById('evaluateBtn').addEventListener('click', evaluatePolicy);
rewardInput.addEventListener('input', updateStatus);
gammaInput.addEventListener('input', updateStatus);

document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        state.mode = button.dataset.mode;
        updateStatus();
        setMessage(`目前模式已切換為：${modeLabelMap[state.mode]}。`);
    });
});

initializeGrid();
