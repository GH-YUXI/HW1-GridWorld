from __future__ import annotations

import random
from collections import deque
from typing import Dict, List, Tuple

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

Grid = List[List[str]]
Policy = Dict[str, str]
Values = Dict[str, float]

ACTIONS: Dict[str, Tuple[int, int, str]] = {
    "U": (-1, 0, "↑"),
    "D": (1, 0, "↓"),
    "L": (0, -1, "←"),
    "R": (0, 1, "→"),
}


def validate_payload(data: dict) -> Tuple[int, Grid, float, float]:
    n = int(data.get("n", 0))
    grid = data.get("grid")
    step_reward = float(data.get("step_reward", -1))
    gamma = float(data.get("gamma", 0.9))

    if n < 5 or n > 9:
        raise ValueError("n 必須介於 5 到 9 之間。")

    if not isinstance(grid, list) or len(grid) != n:
        raise ValueError("網格資料格式不正確。")

    for row in grid:
        if not isinstance(row, list) or len(row) != n:
            raise ValueError("網格資料格式不正確。")
        for cell in row:
            if cell not in {"empty", "start", "end", "obstacle"}:
                raise ValueError("發現無效的格子類型。")

    if not 0 <= gamma <= 1:
        raise ValueError("折扣因子 γ 必須介於 0 到 1 之間。")

    return n, grid, step_reward, gamma


def next_state(n: int, grid: Grid, r: int, c: int, action: str) -> Tuple[int, int]:
    dr, dc, _ = ACTIONS[action]
    nr, nc = r + dr, c + dc

    if nr < 0 or nr >= n or nc < 0 or nc >= n:
        return r, c
    if grid[nr][nc] == "obstacle":
        return r, c
    return nr, nc


def valid_actions(n: int, grid: Grid, r: int, c: int) -> List[str]:
    """Return actions that actually move to another non-obstacle cell."""
    actions: List[str] = []
    for action in ACTIONS:
        nr, nc = next_state(n, grid, r, c, action)
        if (nr, nc) != (r, c):
            actions.append(action)
    return actions


def distance_to_goal_map(n: int, grid: Grid) -> Dict[str, int]:
    end_pos = None
    for r in range(n):
        for c in range(n):
            if grid[r][c] == "end":
                end_pos = (r, c)
                break
        if end_pos is not None:
            break

    if end_pos is None:
        return {}

    distances: Dict[str, int] = {f"{end_pos[0]},{end_pos[1]}": 0}
    queue = deque([end_pos])

    while queue:
        r, c = queue.popleft()
        current_distance = distances[f"{r},{c}"]

        for action in ACTIONS:
            nr, nc = next_state(n, grid, r, c, action)
            key = f"{nr},{nc}"
            if (nr, nc) == (r, c):
                continue
            if grid[nr][nc] == "obstacle":
                continue
            if key in distances:
                continue
            distances[key] = current_distance + 1
            queue.append((nr, nc))

    return distances


def build_random_policy(n: int, grid: Grid) -> Policy:
    distances = distance_to_goal_map(n, grid)
    policy: Policy = {}

    for r in range(n):
        for c in range(n):
            state = grid[r][c]
            if state in {"obstacle", "end"}:
                continue

            key = f"{r},{c}"
            current_distance = distances.get(key)
            if current_distance is None:
                actions = valid_actions(n, grid, r, c) or list(ACTIONS.keys())
                policy[key] = random.choice(actions)
                continue

            candidate_actions: List[str] = []
            for action in valid_actions(n, grid, r, c):
                nr, nc = next_state(n, grid, r, c, action)
                next_distance = distances.get(f"{nr},{nc}")
                if next_distance is not None and next_distance < current_distance:
                    candidate_actions.append(action)

            actions = candidate_actions or valid_actions(n, grid, r, c) or list(ACTIONS.keys())
            policy[key] = random.choice(actions)

    return policy


def policy_evaluation(
    n: int,
    grid: Grid,
    policy: Policy,
    gamma: float = 0.9,
    step_reward: float = -1.0,
    theta: float = 1e-4,
    max_iterations: int = 1000,
) -> Values:
    values: Values = {
        f"{r},{c}": 0.0
        for r in range(n)
        for c in range(n)
        if grid[r][c] != "obstacle"
    }

    for _ in range(max_iterations):
        delta = 0.0
        updated = values.copy()

        for r in range(n):
            for c in range(n):
                cell_type = grid[r][c]
                key = f"{r},{c}"

                if cell_type == "obstacle":
                    continue
                if cell_type == "end":
                    updated[key] = 0.0
                    continue

                action = policy.get(key)
                if action is None:
                    updated[key] = 0.0
                    continue

                nr, nc = next_state(n, grid, r, c, action)
                next_key = f"{nr},{nc}"
                reward = 0.0 if grid[nr][nc] == "end" else step_reward
                new_value = reward + gamma * values[next_key]
                updated[key] = new_value
                delta = max(delta, abs(new_value - values[key]))

        values = updated
        if delta < theta:
            break

    return {k: round(v, 2) for k, v in values.items()}


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/evaluate")
def evaluate():
    try:
        payload = request.get_json(force=True)
        n, grid, step_reward, gamma = validate_payload(payload)

        start_count = sum(cell == "start" for row in grid for cell in row)
        end_count = sum(cell == "end" for row in grid for cell in row)
        obstacle_count = sum(cell == "obstacle" for row in grid for cell in row)

        if start_count != 1 or end_count != 1:
            raise ValueError("請先設定 1 個起點與 1 個終點。")
        if obstacle_count > n - 2:
            raise ValueError(f"障礙物最多只能設定 {n - 2} 個。")

        policy = build_random_policy(n, grid)
        values = policy_evaluation(n, grid, policy, gamma=gamma, step_reward=step_reward)
        arrows = {key: ACTIONS[action][2] for key, action in policy.items()}

        return jsonify(
            {
                "ok": True,
                "policy": policy,
                "arrows": arrows,
                "values": values,
                "message": (
                    f"已成功生成隨機策略並完成策略評估。"
                    f" Reward={step_reward}，γ={gamma}。"
                    f" 障礙物目前為 {obstacle_count} / {n - 2}（最多）。"
                ),
            }
        )
    except ValueError as exc:
        return jsonify({"ok": False, "message": str(exc)}), 400
    except Exception:
        return jsonify({"ok": False, "message": "伺服器發生未預期錯誤。"}), 500


if __name__ == "__main__":
    app.run(debug=True)
