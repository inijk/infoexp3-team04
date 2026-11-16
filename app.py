from flask import Flask, render_template
from auth import auth_bp, init_db

# Flaskアプリケーションの初期化
app = Flask(__name__)

# セッション管理用の秘密鍵
app.secret_key = "suika-game-secret-key"

# 認証・スコア・ランキング用のBlueprintを登録
app.register_blueprint(auth_bp)

# アプリ起動時にデータベースのテーブルを初期化
init_db()


# ルートURL（http://localhost:5000/）にアクセスされた時の処理
@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    # Dockerコンテナ外部からアクセスできるよう host="0.0.0.0" を指定
    app.run(host="0.0.0.0", port=5000, debug=True)