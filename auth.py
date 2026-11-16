import sqlite3
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint("auth", __name__)
DB_PATH = "suika.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """データベースとテーブルの初期化"""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)


@auth_bp.route("/api/login", methods=["POST"])
def login():
    """ゴッドフィールド形式の簡易ログイン（未登録なら自動新規作成）"""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"ok": False, "error": "ユーザー名とパスワードを入力してください"}), 400

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

        if user is None:
            pw_hash = generate_password_hash(password)
            cur = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, pw_hash)
            )
            session["user_id"] = cur.lastrowid
            session["username"] = username
            return jsonify({"ok": True, "username": username, "is_new": True})
        else:
            if check_password_hash(user["password_hash"], password):
                session["user_id"] = user["id"]
                session["username"] = user["username"]
                return jsonify({"ok": True, "username": user["username"], "is_new": False})
            else:
                return jsonify({"ok": False, "error": "パスワードが違います（既に使われている名前です）"}), 401


@auth_bp.route("/api/me", methods=["GET"])
def me():
    """リロード時のログイン状態維持用（DBに実在するかも確認）"""
    if "user_id" in session:
        with get_db() as conn:
            user = conn.execute(
                "SELECT id, username FROM users WHERE id = ?",
                (session["user_id"],)
            ).fetchone()
        if user:
            return jsonify({"logged_in": True, "username": user["username"]})
        # DBから消えていた場合は古いセッションを破棄する
        session.clear()
    return jsonify({"logged_in": False})


@auth_bp.route("/api/my-scores", methods=["GET"])
def my_scores():
    """ログイン中ユーザーのハイスコア上位5件を取得"""
    if "user_id" not in session:
        return jsonify({"ok": False, "scores": []}), 401

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT score, created_at
            FROM scores
            WHERE user_id = ?
            ORDER BY score DESC, created_at DESC
            LIMIT 5
            """,
            (session["user_id"],)
        ).fetchall()

    scores = [{"score": r["score"], "created_at": r["created_at"]} for r in rows]
    return jsonify({
        "ok": True,
        "username": session["username"],
        "scores": scores
    })

@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    """セッションを破棄してログアウトする"""
    session.clear()
    return jsonify({"ok": True})

# === auth.py の末尾に追記 ===

@auth_bp.route("/api/scores", methods=["POST"])
def save_score():
    """ゲームオーバー時のスコアをDBに保存する"""
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "未ログインです"}), 401

    data = request.get_json(silent=True) or {}
    score = data.get("score")

    if not isinstance(score, int) or score < 0:
        return jsonify({"ok": False, "error": "不正なスコアです"}), 400

    with get_db() as conn:
        conn.execute(
            "INSERT INTO scores (user_id, score) VALUES (?, ?)",
            (session["user_id"], score)
        )

    return jsonify({"ok": True})


@auth_bp.route("/api/rankings", methods=["GET"])
def get_rankings():
    """全プレイヤーTOP10と、ログイン中ユーザーのTOP10を返す"""
    with get_db() as conn:
        # 1. 全プレイヤーのハイスコアランキング（上位10件）
        global_rows = conn.execute(
            """
            SELECT u.username, s.score, s.created_at
            FROM scores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.score DESC, s.created_at DESC
            LIMIT 10
            """
        ).fetchall()

        global_ranking = [
            {
                "username": r["username"],
                "score": r["score"],
                "created_at": r["created_at"]
            }
            for r in global_rows
        ]

        # 2. 自分のハイスコアランキング（上位10件）
        my_ranking = []
        if "user_id" in session:
            my_rows = conn.execute(
                """
                SELECT score, created_at
                FROM scores
                WHERE user_id = ?
                ORDER BY score DESC, created_at DESC
                LIMIT 10
                """,
                (session["user_id"],)
            ).fetchall()

            my_ranking = [
                {
                    "username": session["username"],
                    "score": r["score"],
                    "created_at": r["created_at"]
                }
                for r in my_rows
            ]

    return jsonify({
        "ok": True,
        "global_ranking": global_ranking,
        "my_ranking": my_ranking
    })