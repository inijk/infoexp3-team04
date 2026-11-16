from flask import Flask, render_template

# Flaskアプリケーションの初期化
app = Flask(__name__)

# ルートURL（http://localhost:5000/）にアクセスされた時の処理
@app.route("/")
def index():
    # templates/index.html をレンダリングして返す
    return render_template("index.html")

if __name__ == "__main__":
    # Dockerコンテナ外部（ホストOSのブラウザ）からアクセスできるよう host="0.0.0.0" を指定
    app.run(host="0.0.0.0", port=5000, debug=True)