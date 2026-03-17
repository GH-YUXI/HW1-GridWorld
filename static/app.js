const ACTIONS = {
  U: { dr: -1, dc: 0, arrow: '↑' },
  D: { dr: 1, dc: 0, arrow: '↓' },
  L: { dr: 0, dc: -1, arrow: '←' },
  R: { dr: 0, dc: 1, arrow: '→' },
};

const MODE_LABELS = {
  start: '起點',
  end: '終點',
  obstacle: '障礙物',
  empty: '清除格子',
};

let n = 5;
let currentMode = 'start';
let gridState = [];

const gridEl = document.getElementById('grid');
const messageEl = document.getElementById('message');
const gridSizeEl = document.getElementById('gridSize');
const rewardInputEl = document.getElementById('rewardInput');
const gammaInputEl = document.getElementById('gammaInput');
const infoNEl = document.getElementById('infoN');
const infoStartEl = document.getElementById('infoStart');
const infoEndEl = document.getElementById('infoEnd');
const infoObstacleEl = document.getElementById('infoObstacle');
const infoRewardEl = document.getElementById('infoReward');
const infoGammaEl = document.getElementById('infoGamma');
const infoModeEl = document.getElementById('infoMode');

function makeEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'empty'));
}

function stateKey(r, c) {
  return `${r},${c}`;
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function countCells(type) {
  return gridState.flat().filter((cell) => cell === type).length;
}

function obstacleLimit() {
  return n - 2;
}

function setMessage(text, kind = '') {
  messageEl.textContent = text;
  messageEl.className = `message${kind ? ` ${kind}` : ''}`;
}

function updateInfo() {
  infoNEl.textContent = String(n);
  infoStartEl.textContent = `${countCells('start')}/1`;
  infoEndEl.textContent = `${countCells('end')}/1`;
  infoObstacleEl.textContent = `${countCells('obstacle')}/${obstacleLimit()}`;
  infoRewardEl.textContent = rewardInputEl.value;
  infoGammaEl.textContent = gammaInputEl.value;
  infoModeEl.textContent = MODE_LABELS[currentMode];
}

function renderGrid(results = null) {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const cellType = gridState[r][c];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell ${cellType}`;
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const label = document.createElement('div');
      label.className = 'cell-label';
      label.textContent = {
        start: 'S',
        end: 'G',
        obstacle: 'X',
        empty: '',
      }[cellType];
      cell.appendChild(label);

      if (results && cellType !== 'obstacle') {
        const key = stateKey(r, c);
        if (cellType !== 'end' && results.arrows[key]) {
          const arrow = document.createElement('div');
          arrow.className = 'cell-arrow';
          arrow.textContent = results.arrows[key];
          cell.appendChild(arrow);
        }

        if (Object.prototype.hasOwnProperty.call(results.values, key)) {
          const value = document.createElement('div');
          value.className = 'cell-value';
          value.textContent = results.values[key].toFixed(2);
          cell.appendChild(value);
        }
      }

      cell.addEventListener('click', onCellClick);
      gridEl.appendChild(cell);
    }
  }

  updateInfo();
}

function clearSingle(type) {
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (gridState[r][c] === type) {
        gridState[r][c] = 'empty';
      }
    }
  }
}

function onCellClick(event) {
  const r = Number(event.currentTarget.dataset.row);
  const c = Number(event.currentTarget.dataset.col);

  if (currentMode === 'start') {
    clearSingle('start');
    gridState[r][c] = 'start';
  } else if (currentMode === 'end') {
    clearSingle('end');
    gridState[r][c] = 'end';
  } else if (currentMode === 'obstacle') {
    if (gridState[r][c] !== 'obstacle' && countCells('obstacle') >= obstacleLimit()) {
      setMessage(`障礙物最多只能設定 ${obstacleLimit()} 個。`, 'error');
      return;
    }
    gridState[r][c] = gridState[r][c] === 'obstacle' ? 'empty' : 'obstacle';
  } else {
    gridState[r][c] = 'empty';
  }

  setMessage('地圖已更新。');
  renderGrid();
}

function nextState(grid, r, c, action) {
  const { dr, dc } = ACTIONS[action];
  const nr = r + dr;
  const nc = c + dc;

  if (nr < 0 || nr >= n || nc < 0 || nc >= n) {
    return [r, c];
  }

  if (grid[nr][nc] === 'obstacle') {
    return [r, c];
  }

  return [nr, nc];
}

function validateInputs() {
  const startCount = countCells('start');
  const endCount = countCells('end');
  const obstacles = countCells('obstacle');
  const gamma = Number(gammaInputEl.value);
  const reward = Number(rewardInputEl.value);

  if (startCount !== 1 || endCount !== 1) {
    throw new Error('請先設定 1 個起點與 1 個終點。');
  }

  if (obstacles > obstacleLimit()) {
    throw new Error(`障礙物最多只能設定 ${obstacleLimit()} 個。`);
  }

  if (Number.isNaN(gamma) || gamma < 0 || gamma > 1) {
    throw new Error('折扣因子 γ 必須介於 0 到 1 之間。');
  }

  if (Number.isNaN(reward)) {
    throw new Error('步驟獎勵 Reward 必須是數字。');
  }

  return { gamma, reward };
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function valueIteration(grid, gamma = 0.9, stepReward = -1, theta = 1e-4, maxIterations = 1000) {
  const values = {};

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (grid[r][c] !== 'obstacle') {
        values[stateKey(r, c)] = 0;
      }
    }
  }

  let iterations = 0;

  for (; iterations < maxIterations; iterations += 1) {
    let delta = 0;
    const updated = { ...values };

    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const cellType = grid[r][c];
        const key = stateKey(r, c);

        if (cellType === 'obstacle') {
          continue;
        }

        if (cellType === 'end') {
          updated[key] = 0;
          continue;
        }

        let bestValue = Number.NEGATIVE_INFINITY;

        Object.keys(ACTIONS).forEach((action) => {
          const [nr, nc] = nextState(grid, r, c, action);
          const nextKey = stateKey(nr, nc);
          const reward = grid[nr][nc] === 'end' ? 0 : stepReward;
          const candidate = reward + gamma * values[nextKey];
          if (candidate > bestValue) {
            bestValue = candidate;
          }
        });

        updated[key] = bestValue;
        delta = Math.max(delta, Math.abs(bestValue - values[key]));
      }
    }

    Object.assign(values, updated);

    if (delta < theta) {
      iterations += 1;
      break;
    }
  }

  const policy = {};
  const arrows = {};

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const cellType = grid[r][c];
      const key = stateKey(r, c);

      if (cellType === 'obstacle' || cellType === 'end') {
        continue;
      }

      let bestValue = Number.NEGATIVE_INFINITY;
      let bestActions = [];

      Object.keys(ACTIONS).forEach((action) => {
        const [nr, nc] = nextState(grid, r, c, action);
        const nextKey = stateKey(nr, nc);
        const reward = grid[nr][nc] === 'end' ? 0 : stepReward;
        const candidate = reward + gamma * values[nextKey];

        if (candidate > bestValue + 1e-10) {
          bestValue = candidate;
          bestActions = [action];
        } else if (Math.abs(candidate - bestValue) < 1e-10) {
          bestActions.push(action);
        }
      });

      const chosenAction = pickRandom(bestActions);
      policy[key] = chosenAction;
      arrows[key] = ACTIONS[chosenAction].arrow;
    }
  }

  const roundedValues = {};
  Object.entries(values).forEach(([key, value]) => {
    roundedValues[key] = Math.round(value * 100) / 100;
  });

  return { values: roundedValues, policy, arrows, iterations };
}

function loadDemoMap() {
  n = 5;
  gridSizeEl.value = '5';
  gridState = makeEmptyGrid(n);

  gridState[0][0] = 'start';
  gridState[4][4] = 'end';
  gridState[1][1] = 'obstacle';
  gridState[1][3] = 'obstacle';
  gridState[3][1] = 'obstacle';

  rewardInputEl.value = '-1';
  gammaInputEl.value = '0.9';

  renderGrid();
  setMessage('已載入示範地圖，可以直接執行 Value Iteration。');
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  updateInfo();
}

document.getElementById('buildGridBtn').addEventListener('click', () => {
  n = Number(gridSizeEl.value);
  gridState = makeEmptyGrid(n);
  renderGrid();
  setMessage('新網格已建立。');
});

document.getElementById('resetGridBtn').addEventListener('click', () => {
  gridState = makeEmptyGrid(n);
  renderGrid();
  setMessage('地圖設定已清空。');
});

document.getElementById('runBtn').addEventListener('click', () => {
  try {
    const { gamma, reward } = validateInputs();
    const result = valueIteration(cloneGrid(gridState), gamma, reward);
    renderGrid(result);
    setMessage(
      `已完成 Value Iteration，共迭代 ${result.iterations} 次。Reward=${reward}，γ=${gamma}。`,
      'success',
    );
  } catch (error) {
    setMessage(error.message || '執行失敗。', 'error');
  }
});

document.getElementById('demoBtn').addEventListener('click', loadDemoMap);

rewardInputEl.addEventListener('input', updateInfo);
gammaInputEl.addEventListener('input', updateInfo);

document.querySelectorAll('.mode-btn').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

gridState = makeEmptyGrid(n);
renderGrid();
setMode('start');
