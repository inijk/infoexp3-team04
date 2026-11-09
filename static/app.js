/**
 * サーバーから現在のメッセージ一覧を取得し、画面のHTMLを更新する関数
 */
async function loadMessages() { 
    const r = await fetch('/api/messages'); 
    const xs = await r.json(); 

    document.querySelector('#messages').innerHTML = xs.map(x => 
        `<article class="message"><b>${escapeHtml(x.name)}</b><p>${escapeHtml(x.message)}</p><div class="meta">#${x.id}</div></article>`
    ).join('');
}

/**
 * 【セキュリティ対策】ユーザーが入力した特殊文字を安全にエスケープする関数（XSS対策）
 */
function escapeHtml(s) { 
    const d = document.createElement('div'); 
    d.textContent = s; 
    return d.innerHTML; 
}

// 要素の取得
const form = document.querySelector('#form');
const nameInput = document.querySelector('#name');
const messageInput = document.querySelector('#message');
const statusEl = document.querySelector('#status');

/**
 * 【追加】入力内容を監視し、スペースのみの場合にもブラウザのポップアップが出るようにする関数
 */
function validateInputs() {
    // 1. 名前欄のチェック（未入力 または スペース・タブのみの場合）
    if (nameInput.value.trim() === '') {
        nameInput.setCustomValidity('名前を空文字やスペースのみにしないでください');
    } else {
        nameInput.setCustomValidity(''); // エラーなし
    }

    // 2. メッセージ欄のチェック
    if (messageInput.value.trim() === '') {
        messageInput.setCustomValidity('メッセージを空文字やスペースのみにしないでください');
    } else {
        messageInput.setCustomValidity(''); // エラーなし
    }
}

// ユーザーが文字を入力するたびに、リアルタイムでバリデーション状態を更新する
nameInput.addEventListener('input', validateInputs);
messageInput.addEventListener('input', validateInputs);

/**
 * 「投稿」ボタンが押されたとき（フォーム送信時）の処理
 */
form.addEventListener('submit', async e => { 
    e.preventDefault(); // 画面の自動リロードを防ぐ
    
    // 送信直前にも念のためチェックを実行
    validateInputs();
    
    // もしブラウザの標準チェック（required や customValidity）に引っかかっている場合は送信しない
    if (!form.checkValidity()) {
        form.reportValidity(); // ブラウザ標準のポップアップを表示する
        return;
    }

    const name = nameInput.value; 
    const message = messageInput.value; 

    // サーバーへPOSTリクエストを送信
    const r = await fetch('/api/messages', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ name, message }) 
    }); 

    // 通信結果に応じた処理
    if (r.ok) { 
        statusEl.textContent = '投稿しました';
        messageInput.value = ''; // メッセージ欄をクリア
        validateInputs();        // クリア後にバリデーション状態をリセット
        await loadMessages();    // 一覧を再読み込み
    } else { 
        // サーバー側でエラーが返ってきた場合
        const errorData = await r.json().catch(() => ({}));
        statusEl.textContent = errorData.error || '投稿に失敗しました';
    } 
});

// ページ読み込み時に一度メッセージを一覧表示
loadMessages();