// Matter.jsの主要モジュールを取り出す
const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

// ゲーム画面のサイズとゲームオーバー判定ライン（Y座標）
const WIDTH = 400;
const HEIGHT = 600;
const DEADLINE_Y = 100;

// 動物の定義（レベル順：半径、色、獲得スコア、画像パス）
const ANIMALS = [
    { name: "ハムスター", radius: 15, color: "#ff4d4d", score: 10, src: "images/hamster_0.png" },
    { name: "ハリネズミ", radius: 22, color: "#ff85a2", score: 20, src: "images/hedgehog_0.png" },
    { name: "オウム",     radius: 30, color: "#a262ff", score: 40, src: "images/parrot_0.png" },
    { name: "コアラ",     radius: 38, color: "#ffb84d", score: 80, src: "images/koala_0.png" },
    { name: "ひつじ",     radius: 48, color: "#ff9933", score: 160, src: "images/sheep_0.png" },
    { name: "ライオン",   radius: 60, color: "#e62e00", score: 320, src: "images/lion_0.png" },
    { name: "カバ",       radius: 75, color: "#99e600", score: 640, src: "images/hippo_0.png" },
    { name: "ゾウ",       radius: 95, color: "#33cc33", score: 1280, src: "images/elephant_0.png" }
];

// 画像を事前に読み込んで保持する
const animalImages = ANIMALS.map(animal => {
    const img = new Image();
    img.src = animal.src;
    return img;
});

// ゲームの状態管理変数
let score = 0;
let currentAnimalIndex = 0; // 現在落とす準備中の動物
let nextAnimalIndex = 0;    // 次の動物
let currentX = WIDTH / 2;   // 落下位置のX座標
let canDrop = true;         // 連続落下防止フラグ
let isGameOver = false;     // ゲームオーバー状態フラグ

// HTML要素の取得
const scoreEl = document.getElementById("score");
const nextAnimalEl = document.getElementById("next-fruit"); // HTML側のIDそのまま
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
        wireframes: false,
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

// 0$301C3番目までの小さい動物からランダムにインデックスを返す
function getRandomAnimalIndex() {
    return Math.floor(Math.random() * 4);
}

// 次の動物表示を更新する（HTMLの要素に画像を丸く表示）
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
        restitution: 0.2, // 反発係数（跳ねにくさ）
        friction: 0.1,    // 摩擦係数
        // 標準の単色円は描画せず、下の afterRender で写真を自前描画する
        render: { visible: false }
    });
    // カスタムプロパティとしてレベルと合体済みフラグを持たせる
    body.animalIndex = index;
    body.isMerged = false;
    body.createdAt = Date.now(); // ゲームオーバー判定の猶予用タイムスタンプ
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

    // 円形の切り抜きパスを作成
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 画像が読み込み済みなら描画、未完了なら代替色で塗りつぶし
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -r, -r, r * 2, r * 2);
    } else {
        ctx.fillStyle = animal.color;
        ctx.fill();
    }

    ctx.restore();

    // 動物同士の境界が分かりやすいよう薄い枠線を描画
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

// マウス移動で落下X座標を更新
wrapperEl.addEventListener("mousemove", (e) => {
    if (isGameOver) return;
    const rect = wrapperEl.getBoundingClientRect();
    const radius = ANIMALS[currentAnimalIndex].radius;
    // 壁にめり込まないようX座標を制限
    let x = e.clientX - rect.left;
    currentX = Math.max(radius, Math.min(WIDTH - radius, x));
});

// クリックで動物を落下させる
wrapperEl.addEventListener("click", () => {
    if (!canDrop || isGameOver) return;

    canDrop = false;
    const animalBody = createAnimal(currentX, 50, currentAnimalIndex);
    Composite.add(world, animalBody);

    // 0.5秒後に次の動物をセット
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

        // 両方が動物であり、同じレベル、かつ未合体の場合
        if (
            bodyA.animalIndex !== undefined &&
            bodyB.animalIndex !== undefined &&
            bodyA.animalIndex === bodyB.animalIndex &&
            !bodyA.isMerged &&
            !bodyB.isMerged
        ) {
            const index = bodyA.animalIndex;
            // 最大サイズ（ゾウ）同士なら何もしない
            if (index >= ANIMALS.length - 1) continue;

            // 多重合体を防ぐためフラグを立てる
            bodyA.isMerged = true;
            bodyB.isMerged = true;

            // 2つの動物の中間地点を計算
            const midX = (bodyA.position.x + bodyB.position.x) / 2;
            const midY = (bodyA.position.y + bodyB.position.y) / 2;

            // 古い動物を削除し、1段階大きい動物を生成
            Composite.remove(world, [bodyA, bodyB]);
            const newAnimal = createAnimal(midX, midY, index + 1);
            Composite.add(world, newAnimal);

            // スコア加算
            score += ANIMALS[index].score;
            scoreEl.textContent = score;
        }
    }
});

// 5. 毎フレームの描画後処理（動物の画像描画・デッドライン・照準ガイド・ゲームオーバー判定）
Events.on(render, "afterRender", () => {
    const ctx = render.context;
    const bodies = Composite.allBodies(world);

    // ワールド内の全動物を円形写真で描画
    for (let body of bodies) {
        if (body.animalIndex !== undefined) {
            drawAnimal(ctx, body.position.x, body.position.y, body.animalIndex, body.angle, 1.0);
        }
    }

    // デッドライン（赤い破線）の描画
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, DEADLINE_Y);
    ctx.lineTo(WIDTH, DEADLINE_Y);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.stroke();
    ctx.setLineDash([]);

    // 落下前の動物のプレビュー表示（半透明）
    if (canDrop && !isGameOver) {
        drawAnimal(ctx, currentX, 50, currentAnimalIndex, 0, 0.6);
    }

    // ゲームオーバー判定
    if (!isGameOver) {
        const now = Date.now();
        for (let body of bodies) {
            // 生成から2秒以上経過した動物がデッドラインより上に留まっていたら終了
            if (
                body.animalIndex !== undefined &&
                now - body.createdAt > 2000 &&
                body.position.y - ANIMALS[body.animalIndex].radius < DEADLINE_Y
            ) {
                isGameOver = true;
                gameOverEl.classList.remove("hidden");
                break;
            }
        }
    }
});
