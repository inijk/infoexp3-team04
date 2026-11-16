// Matter.jsの主要モジュールを取り出す
const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

// ゲーム画面および容器（箱）のサイズ・座標定義
const WIDTH = 400;
const HEIGHT = 400;
const BOX_WIDTH = 280;
const BOX_HEIGHT = 450;
const boxLeft = (WIDTH - BOX_WIDTH) / 2; // 60
const boxTop = HEIGHT - BOX_HEIGHT;      // 150
const DEADLINE_Y = boxTop;               // 150

// 動物の定義（レベル順：名前、半径、代替色、獲得スコア）
const ANIMALS = [
    { name: "ハムスター", radius: 15, color: "#ff4d4d", score: 10 },
    { name: "ハリネズミ", radius: 22, color: "#ff85a2", score: 20 },
    { name: "オウム",     radius: 30, color: "#a262ff", score: 40 },
    { name: "コアラ",     radius: 38, color: "#ffb84d", score: 80 },
    { name: "ひつじ",     radius: 48, color: "#ff9933", score: 160 },
    { name: "ライオン",   radius: 60, color: "#e62e00", score: 320 },
    { name: "カバ",       radius: 75, color: "#99e600", score: 640 },
    { name: "ゾウ",       radius: 95, color: "#33cc33", score: 1280 }
];

// HTML側から渡されたFlaskの正確な画像パスをANIMALSに結合し、画像を事前読み込み
const animalImages = ANIMALS.map((animal, index) => {
    const imageUrl = (typeof FLASK_IMAGE_URLS !== "undefined")
        ? FLASK_IMAGE_URLS[index]
        : `/static/images/animal_${index}.png`;
    animal.src = imageUrl;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => console.log(`[成功] 画像ロードOK: ${animal.name} (${imageUrl})`);
    img.onerror = () => console.error(`[エラー] 画像が見つかりません: ${imageUrl}`);
    return img;
});

// ゲームの状態管理変数
let score = 0;
let currentAnimalIndex = 0;
let nextAnimalIndex = 0;
let currentX = WIDTH / 2;
let canDrop = true;
let isGameOver = false;
let isGameStarted = false;

// HTML要素の取得（ゲーム用）
const scoreEl = document.getElementById("score");
const nextAnimalEl = document.getElementById("next-fruit");
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
// 1. ゲーム本体（ログイン完了後にのみ起動）
// ==========================================
function startGame() {
    if (isGameStarted) return;
    isGameStarted = true;

    // 物理エンジンの初期化
    const engine = Engine.create();
    const world = engine.world;

    // レンダラーの作成と起動
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

    // 3. 容器（床・左壁・右壁）の作成（280x450の箱を中央下部に配置）
    const wallOptions = { isStatic: true, render: { fillStyle: "#8b5a2b" } };
    const wallThickness = 10;

    const ground = Bodies.rectangle(
        WIDTH / 2,
        HEIGHT + wallThickness / 2,
        BOX_WIDTH + wallThickness * 2,
        wallThickness,
        wallOptions
    );
    const leftWall = Bodies.rectangle(
        boxLeft - wallThickness / 2,
        boxTop + BOX_HEIGHT / 2,
        wallThickness,
        BOX_HEIGHT,
        wallOptions
    );
    const rightWall = Bodies.rectangle(
        boxLeft + BOX_WIDTH + wallThickness / 2,
        boxTop + BOX_HEIGHT / 2,
        wallThickness,
        BOX_HEIGHT,
        wallOptions
    );
    Composite.add(world, [ground, leftWall, rightWall]);

    // 0〜3番目までの小さい動物からランダムにインデックスを返す
    function getRandomAnimalIndex() {
        return Math.floor(Math.random() * 4);
    }

    // 次の動物表示を更新する
    function updateNextDisplay() {
        const nextAnimal = ANIMALS[nextAnimalIndex];
        nextAnimalEl.innerHTML = `<img src="${nextAnimal.src}" alt="${nextAnimal.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; vertical-align: middle;">`;
    }

    // 初期動物のセット
    currentAnimalIndex = getRandomAnimalIndex();
    nextAnimalIndex = getRandomAnimalIndex();
    updateNextDisplay();

    // 動物の物理ボディを生成する関数
    function createAnimal(x, y, index) {
        const animal = ANIMALS[index];
        const body = Bodies.circle(x, y, animal.radius, {
            restitution: 0.2,
            friction: 0.1,
            render: { visible: false }
        });
        body.animalIndex = index;
        body.isMerged = false;
        body.createdAt = Date.now();
        return body;
    }

    // 動物を円形に切り抜いて描画するヘルパー関数
    function drawAnimal(ctx, x, y, index, angle = 0, alpha = 1.0) {
        const animal = ANIMALS[index];
        const img = animalImages[index];
        const r = animal.radius;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, -r, -r, r * 2, r * 2);
        } else {
            ctx.fillStyle = animal.color;
            ctx.fill();
        }
        ctx.restore();

        // 薄い境界線
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    // マウス移動で落下X座標を更新（箱の内側に制限）
    wrapperEl.addEventListener("mousemove", (e) => {
        if (isGameOver) return;
        const rect = wrapperEl.getBoundingClientRect();
        const radius = ANIMALS[currentAnimalIndex].radius;
        const x = e.clientX - rect.left;
        currentX = Math.max(
            boxLeft + radius,
            Math.min(boxLeft + BOX_WIDTH - radius, x)
        );
    });

    // クリックで動物を落下させる
    wrapperEl.addEventListener("click", () => {
        if (!canDrop || isGameOver) return;

        canDrop = false;
        const radius = ANIMALS[currentAnimalIndex].radius;
        // 落下位置も箱の左右範囲内に収める
        const spawnX = Math.max(
            boxLeft + radius,
            Math.min(boxLeft + BOX_WIDTH - radius, currentX)
        );
        const dropY = boxTop - radius - 10; // 箱の上部ラインのすぐ上から落下

        const animalBody = createAnimal(spawnX, dropY, currentAnimalIndex);
        Composite.add(world, animalBody);

        setTimeout(() => {
            currentAnimalIndex = nextAnimalIndex;
            nextAnimalIndex = getRandomAnimalIndex();
            updateNextDisplay();
            canDrop = true;
        }, 500);
    });

    // 4. 衝突検知（同じ動物同士がぶつかった時の合体処理）
    Events.on(engine, "collisionStart", (event) => {
        const pairs = event.pairs;

        for (let i = 0; i < pairs.length; i++) {
            const bodyA = pairs[i].bodyA;
            const bodyB = pairs[i].bodyB;

            if (
                bodyA.animalIndex !== undefined &&
                bodyB.animalIndex !== undefined &&
                bodyA.animalIndex === bodyB.animalIndex &&
                !bodyA.isMerged &&
                !bodyB.isMerged
            ) {
                const index = bodyA.animalIndex;
                if (index >= ANIMALS.length - 1) continue;

                bodyA.isMerged = true;
                bodyB.isMerged = true;

                const midX = (bodyA.position.x + bodyB.position.x) / 2;
                const midY = (bodyA.position.y + bodyB.position.y) / 2;

                Composite.remove(world, [bodyA, bodyB]);
                const newAnimal = createAnimal(midX, midY, index + 1);
                Composite.add(world, newAnimal);

                score += ANIMALS[index].score;
                scoreEl.textContent = score;
            }
        }
    });

    // 5. 毎フレームの描画後処理（動物描画・デッドライン・照準ガイド・ゲームオーバー判定）
    Events.on(render, "afterRender", () => {
        const ctx = render.context;
        const bodies = Composite.allBodies(world);

        // ワールド内の全動物を円形写真で描画
        for (let body of bodies) {
            if (body.animalIndex !== undefined) {
                drawAnimal(ctx, body.position.x, body.position.y, body.animalIndex, body.angle, 1.0);
            }
        }

        // デッドライン（箱の上端ライン）の描画
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(boxLeft, DEADLINE_Y);
        ctx.lineTo(boxLeft + BOX_WIDTH, DEADLINE_Y);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.stroke();
        ctx.setLineDash([]);

        // 落下前の動物のプレビュー表示（半透明）
        if (canDrop && !isGameOver) {
            const radius = ANIMALS[currentAnimalIndex].radius;
            const previewX = Math.max(
                boxLeft + radius,
                Math.min(boxLeft + BOX_WIDTH - radius, currentX)
            );
            const previewY = boxTop - radius - 10;
            drawAnimal(ctx, previewX, previewY, currentAnimalIndex, 0, 0.6);
        }

        // ゲームオーバー判定
        if (!isGameOver) {
            const now = Date.now();
            for (let body of bodies) {
                if (
                    body.animalIndex !== undefined &&
                    now - body.createdAt > 2000 &&
                    body.position.y - ANIMALS[body.animalIndex].radius < DEADLINE_Y
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
loginOverlayEl.addEventListener("click", (e) => {
    e.stopPropagation();
});

async function loadRankings() {
    try {
        const res = await fetch("/api/rankings");
        const data = await res.json();
        if (!data.ok) return;

        // 左パネル：自分のランキング
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

        // 右パネル：全プレイヤーのランキング
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

function onLoginSuccess(username) {
    playerNameEl.textContent = username;
    myRankingNameEl.textContent = username;
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    loginOverlayEl.classList.add("hidden");
    loginOverlayEl.style.display = "none";

    loadRankings();
    startGame();
}

// 初期表示時に全体ランキングを取得
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