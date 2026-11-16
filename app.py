from flask import Flask, render_template
from auth import auth_bp, init_db  # ←【追加】from auth import auth_bp, init_db  # ←【追加】

# Flaskアプリケーションの初期化
app = Flask(__name__)
app.secret_key = "suika-game-secret-key"  # ←【追加】セッション管理用の秘密鍵
app.register_blueprint(auth_bp)           # ←【追加】認証APIを登録
init_db()                                 # ←【追加】DBテーブル初期化

# ルートURL（http://localhost:5000/）にアクセスされた時の処理
@app.route("/")
def index():
    # templates/index.html をレンダリングして返す
    return render_template("index.html")

if __name__ == "__main__":
    # Dockerコンテナ外部（ホストOSのブラウザ）からアクセスできるよう host="0.0.0.0" を指定
    app.run(host="0.0.0.0", port=5000, debug=True)