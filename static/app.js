// Matter.jsの主要モジュールを取り出す
const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

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

// HTML要素の取得
const scoreEl = document.getElementById("score");
const nextFruitEl = document.getElementById("next-fruit");
const gameOverEl = document.getElementById("game-over");
const wrapperEl = document.getElementById("canvas-wrapper");

// 1. 物理エンジンの初期化
const engine = Engine.create();
const world = engine.world;

// 2. レンダラー（描画処理）の作成
const render = Render.create({
    element: wrapperEl,
    engine: engine,
    options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false, // 塗りつぶし色で描画する
        background: "transparent"
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 3. 容器（床・左壁・右壁）の作成（isStatic: true で固定）
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
        restitution: 0.2, // 反発係数（跳ねにくさ）
        friction: 0.1,    // 摩擦係数
        render: { fillStyle: fruit.color }
    });
    // カスタムプロパティとしてレベルと合体済みフラグを持たせる
    body.fruitIndex = index;
    body.isMerged = false;
    body.createdAt = Date.now(); // ゲームオーバー判定の猶予用タイムスタンプ
    return body;
}

// マウス移動で落下X座標を更新
wrapperEl.addEventListener("mousemove", (e) => {
    if (isGameOver) return;
    const rect = wrapperEl.getBoundingClientRect();
    const radius = FRUITS[currentFruitIndex].radius;
    // 壁にめり込まないようX座標を制限
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

// 4. 衝突検知（同じフルーツ同士がぶつかった時の合体処理）
Events.on(engine, "collisionStart", (event) => {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        // 両方がフルーツであり、同じレベル、かつ未合体の場合
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

// 5. 毎フレームの描画後処理（デッドライン・照準ガイド・ゲームオーバー判定）
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
                gameOverEl.classList.remove("hidden");
                break;
            }
        }
    }
});