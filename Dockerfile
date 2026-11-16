# 軽量なPython 3.11の公式イメージをベースにする
FROM python:3.11-slim

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# 依存ライブラリ一覧を先にコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# プロジェクトの全ファイルをコンテナ内にコピー
COPY . .

# Flaskが使用するポート番号を明示
EXPOSE 5000

# コンテナ起動時にPythonサーバーを実行
CMD ["python", "app.py"]