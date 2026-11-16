// Matter.jsの主要モジュールを取り出す
const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;

// ゲーム画面のサイズとゲームオーバー判定ライン（Y座標）
const WIDTH = 400;
const HEIGHT = 600;
const DEADLINE_Y = 100;

// フルーツの定義（レベル順：半径、色、獲得スコア）
const FRUITS = [
    { radius: 15, color: "#ff4d4d", score: 10 },  // 0: さくらんぼ
    { radius: 22, color: "#ff85a2", score: 20 },  // 1: いちご
    { radius: 30, color: "#a262ff", score: 40 },  // 2: ぶどう
    { radius: 38, color: "#ffb84d", score: 80 },  // 3: デコポン
    { radius: 48, color: "#ff9933", score: 160 }, // 4: かき
    { radius: 60, color: "#e62e00", score: 320 }, // 5: りんご
    { radius: 75, color: "#99e600", score: 640 }, // 6: なし
    { radius: 95, color: "#33cc33", score: 1280 } // 7: スイカ（最大）
];

// ゲームの状態管理変数
let score = 0;
let currentFruitIndex = 0; // 現在落とす準備中のフルーツ
let nextFruitIndex = 0;    // 次のフルーツ
let currentX = WIDTH / 2;  // 落下位置のX座標
let canDrop = true;        // 連続落下防止フラグ
let isGameOver = false;    // ゲームオーバー状態フラグ
let isGameStarted = false; // ゲーム二重起動防止フラグ

// HTML要素の取得（ゲーム用）
const scoreEl = document.getElementById("score");
const nextFruitEl = document.getElementById("next-fruit");
const gameOverEl = document.getElementById("game-over");
const wrapperEl = document.getElementById("canvas-wrapper");

// HTML要素の取得（ログイン・ランキング用）
const loginOverlayEl = document.getElementById("login-overlay");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const loginErrorEl = document.getElementById("login-error");
const playerNameEl = document.getElementById("player-name");
const logoutBtn = document.getElementById("logout-btn");
const myRankingNameEl = document.getElementById("my-ranking-name");
const myRankingListEl = document.getElementById("my-ranking-list");
const globalRankingListEl = document.getElementById("global-ranking-list");

// ==========================================
// 1. ゲーム本体（ログイン完了後にのみ呼ばれる）
// ==========================================
function startGame() {
    if (isGameStarted) return;
    isGameStarted = true;

    // 物理エンジンの初期化
    const engine = Engine.create();
    const world = engine.world;

    // レンダラー（描画処理）の作成と起動
    const render = Render.create({
        element: wrapperEl,
        engine: engine,
        options: {
            width: WIDTH,
            height: HEIGHT,
            wireframes: false,
            background: "transparent"
        }
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // 容器（床・左壁・右壁）の作成（isStatic: true で固定）
    const wallOptions = { isStatic: true, render: { fillStyle: "#8b5a2b" } };
    const ground = Bodies.rectangle(WIDTH / 2, HEIGHT + 25, WIDTH, 50, wallOptions);
    const leftWall = Bodies.rectangle(-25, HEIGHT / 2, 50, HEIGHT, wallOptions);
    const rightWall = Bodies.rectangle(WIDTH + 25, HEIGHT / 2, 50, HEIGHT, wallOptions);
    Composite.add(world, [ground, leftWall, rightWall]);

    // 0〜3番目までの小さいフルーツからランダムにインデックスを返す
    function getRandomFruitIndex() {
        return Math.floor(Math.random() * 4);
    }

    // 次のフルーツ表示を更新する
    function updateNextDisplay() {
        nextFruitEl.style.color = FRUITS[nextFruitIndex].color;
    }

    // 初期フルーツのセット
    currentFruitIndex = getRandomFruitIndex();
    nextFruitIndex = getRandomFruitIndex();
    updateNextDisplay();

    // フルーツの物理ボディを生成する関数
    function createFruit(x, y, index) {
        const fruit = FRUITS[index];
        const body = Bodies.circle(x, y, fruit.radius, {
            restitution: 0.2,
            friction: 0.1,
            render: { fillStyle: fruit.color }
        });
        body.fruitIndex = index;
        body.isMerged = false;
        body.createdAt = Date.now();
        return body;
    }

    // マウス移動で落下X座標を更新
    wrapperEl.addEventListener("mousemove", (e) => {
        if (isGameOver) return;
        const rect = wrapperEl.getBoundingClientRect();
        const radius = FRUITS[currentFruitIndex].radius;
        let x = e.clientX - rect.left;
        currentX = Math.max(radius, Math.min(WIDTH - radius, x));
    });

    // クリックでフルーツを落下させる
    wrapperEl.addEventListener("click", () => {
        if (!canDrop || isGameOver) return;

        canDrop = false;
        const fruitBody = createFruit(currentX, 50, currentFruitIndex);
        Composite.add(world, fruitBody);

        // 0.5秒後に次のフルーツをセット
        setTimeout(() => {
            currentFruitIndex = nextFruitIndex;
            nextFruitIndex = getRandomFruitIndex();
            updateNextDisplay();
            canDrop = true;
        }, 500);
    });

    // 衝突検知（同じフルーツ同士がぶつかった時の合体処理）
    Events.on(engine, "collisionStart", (event) => {
        const pairs = event.pairs;

        for (let i = 0; i < pairs.length; i++) {
            const bodyA = pairs[i].bodyA;
            const bodyB = pairs[i].bodyB;

            if (
                bodyA.fruitIndex !== undefined &&
                bodyB.fruitIndex !== undefined &&
                bodyA.fruitIndex === bodyB.fruitIndex &&
                !bodyA.isMerged &&
                !bodyB.isMerged
            ) {
                const index = bodyA.fruitIndex;
                // 最大サイズ（スイカ）同士なら何もしない
                if (index >= FRUITS.length - 1) continue;

                // 多重合体を防ぐためフラグを立てる
                bodyA.isMerged = true;
                bodyB.isMerged = true;

                // 2つのフルーツの中間地点を計算
                const midX = (bodyA.position.x + bodyB.position.x) / 2;
                const midY = (bodyA.position.y + bodyB.position.y) / 2;

                // 古いフルーツを削除し、1段階大きいフルーツを生成
                Composite.remove(world, [bodyA, bodyB]);
                const newFruit = createFruit(midX, midY, index + 1);
                Composite.add(world, newFruit);

                // スコア加算
                score += FRUITS[index].score;
                scoreEl.textContent = score;
            }
        }
    });

    // 毎フレームの描画後処理（デッドライン・照準ガイド・ゲームオーバー判定）
    Events.on(render, "afterRender", () => {
        const ctx = render.context;

        // デッドライン（赤い破線）の描画
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(0, DEADLINE_Y);
        ctx.lineTo(WIDTH, DEADLINE_Y);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.stroke();
        ctx.setLineDash([]);

        // 落下前のフルーツのプレビュー表示
        if (canDrop && !isGameOver) {
            const preview = FRUITS[currentFruitIndex];
            ctx.beginPath();
            ctx.arc(currentX, 50, preview.radius, 0, Math.PI * 2);
            ctx.fillStyle = preview.color;
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // ゲームオーバー判定
        if (!isGameOver) {
            const bodies = Composite.allBodies(world);
            const now = Date.now();
            for (let body of bodies) {
                // 生成から2秒以上経過したフルーツがデッドラインより上に留まっていたら終了
                if (
                    body.fruitIndex !== undefined &&
                    now - body.createdAt > 2000 &&
                    body.position.y - FRUITS[body.fruitIndex].radius < DEADLINE_Y
                ) {
                    isGameOver = true;
                    document.getElementById("final-score-text").textContent = `今回のスコア: ${score} 点`;
                    gameOverEl.classList.remove("hidden");
                    submitScore(score);
                    break;
                }
            }
        }
    });
}

// ==========================================
// 2. ログイン・スコア保存・左右ランキング表示処理
// ==========================================

// ログインモーダル内のクリックがゲーム画面に伝わらないようにする
loginOverlayEl.addEventListener("click", (e) => {
    e.stopPropagation();
});

// 左右のランキング表を描画する関数
async function loadRankings() {
    try {
        const res = await fetch("/api/rankings");
        const data = await res.json();
        if (!data.ok) return;

        // 1. 左パネル：自分のランキング
        if (data.my_ranking.length === 0) {
            myRankingListEl.innerHTML = "<li>まだ記録がありません</li>";
        } else {
            myRankingListEl.innerHTML = data.my_ranking
                .map(item => `
                    <li>
                        <strong>${item.score} 点</strong>
                        <span class="rank-meta">${item.username} / ${item.created_at}</span>
                    </li>
                `)
                .join("");
        }

        // 2. 右パネル：全プレイヤーのランキング
        if (data.global_ranking.length === 0) {
            globalRankingListEl.innerHTML = "<li>まだ記録がありません</li>";
        } else {
            globalRankingListEl.innerHTML = data.global_ranking
                .map(item => `
                    <li>
                        <strong>${item.username}</strong> : ${item.score} 点
                        <span class="rank-meta">${item.created_at}</span>
                    </li>
                `)
                .join("");
        }
    } catch (err) {
        console.error("ランキング取得エラー:", err);
    }
}

// ゲームオーバー時にスコアをDBへ送信してランキングを再読み込み
async function submitScore(finalScore) {
    try {
        await fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score: finalScore })
        });
        await loadRankings();
    } catch (err) {
        console.error("スコア保存エラー:", err);
    }
}

// ログイン成功時の処理
function onLoginSuccess(username) {
    playerNameEl.textContent = username;
    myRankingNameEl.textContent = username;
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    loginOverlayEl.classList.add("hidden");
    loginOverlayEl.style.display = "none";

    loadRankings();
    startGame();
}

// 初期表示時にも全体ランキングだけは先に読み込んでおく
loadRankings();

// ページ読み込み時にセッションが残っていれば自動ログイン
fetch("/api/me")
    .then(res => res.json())
    .then(data => {
        if (data.logged_in) {
            onLoginSuccess(data.username);
        }
    })
    .catch(err => console.error("セッション確認エラー:", err));

// ログインボタン押下時の処理
loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    loginErrorEl.textContent = "";

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput.value,
                password: passwordInput.value
            })
        });
        const data = await res.json();
        if (data.ok) {
            onLoginSuccess(data.username);
        } else {
            loginErrorEl.textContent = data.error || "ログインに失敗しました";
        }
    } catch (err) {
        loginErrorEl.textContent = "通信エラーが発生しました";
        console.error(err);
    }
});

// ユーザー切替（ログアウト）ボタン
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await fetch("/api/logout", { method: "POST" });
        location.reload();
    });
}