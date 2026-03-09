# Grid Map Policy Evaluation with Flask

> 一個以 **Flask + HTML/CSS/JavaScript** 開發的互動式網格地圖專案。<br>
> 使用者可建立 `n x n` 地圖（`5 ≤ n ≤ 9`）、設定起點 / 終點 / 障礙物，並對隨機策略進行 **Policy Evaluation**，計算每個狀態的價值 `V(s)`。

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Flask](https://img.shields.io/badge/Flask-Web%20App-black)
![License](https://img.shields.io/badge/Usage-Educational-green)

---

## Live Demo
GitHub Pages: https://github.com/GH-YUXI/HW1-GridWorld

## Local Run (Flask version)
python_version=3.14.3

pip install -r requirements.txt

python app.py

Open Browser: http://127.0.0.1:5000

---

## 專案特色

### 互動式網格地圖
- 支援使用者選擇 `5 x 5` 到 `9 x 9` 的網格尺寸。
- 透過滑鼠點擊設定：
  - **起點**：綠色
  - **終點**：紅色
  - **障礙物**：灰色
- 障礙物數量限制為 **`n - 2`**，符合題目要求。
- 可隨時清除格子或重設地圖。

### 隨機策略顯示
- 系統會對每個可行走狀態隨機指定一個動作：
  - `↑` 上
  - `↓` 下
  - `←` 左
  - `→` 右
- 箭頭直接顯示在各格子中，方便觀察策略分布。

### 策略評估（Policy Evaluation）
- 根據隨機策略，對每個狀態進行價值更新。
- 採用反覆迭代方式求得 `V(s)`。
- 可清楚展示「策略固定時，各狀態的長期期望回報」。
---

## 系統畫面重點
- 操作流程明確：先建地圖，再設定角色，再執行評估。
- 顏色區分清楚：起點 / 終點 / 障礙物一目了然。
- 計算結果直接顯示於格子內：同時看到 **策略箭頭** 與 **狀態價值**。
- 不需重新整理頁面即可操作，互動流暢。

---
## 技術架構

### 後端
- **Flask**：處理頁面渲染與 API 請求。
- **Python**：負責策略生成、狀態轉移、策略評估計算。

### 前端
- **HTML**：頁面結構
- **CSS**：網格樣式、顏色與版面配置
- **JavaScript**：滑鼠互動、格子更新、呼叫後端 API

---
## 專案結構

```bash
flask_grid_policy_app/
├── app.py
├── requirements.txt
├── README.md
├── docs/
│   └── POLICY_EVALUATION_EXPLAINED.md
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```
---
## 使用流程

1. 選擇網格大小 `n`。
2. 點擊「建立網格」。
3. 切換操作模式：
   - 起點
   - 終點
   - 障礙物
   - 清除
4. 用滑鼠點擊格子完成地圖設定。
5. 確認障礙物數量為 `n - 2`。
6. 點擊「產生隨機策略並評估 V(s)」。
7. 查看每格：
   - 隨機策略箭頭
   - 狀態價值 `V(s)`
---

## 策略評估模型設定

本專案預設參數如下：

- 折扣因子：`γ = 0.9`
- 一般步驟回饋：`reward = -1`
- 終點價值：`V(goal) = 0`
- 收斂門檻：`θ = 1e-4`

規則說明：
- 若動作會撞牆或撞到障礙物，角色會留在原地。
- 若移動後抵達終點，該步回饋為 `0`。
- 其他一般移動皆給予 `-1` 的步驟成本。

更完整的公式說明請參考：

- [策略評估公式說明](docs/POLICY_EVALUATION_EXPLAINED.md)

---

## 程式核心概念

### 1. 隨機策略產生
對每個非障礙、非終點的狀態，隨機指定一個動作。

### 2. 狀態轉移
根據策略決定下一步：
- 可通行則前往下一格
- 若越界或撞到障礙物，則停留原狀態

### 3. 狀態價值更新
透過多次迭代更新每個狀態的價值，直到前後變化很小為止。
