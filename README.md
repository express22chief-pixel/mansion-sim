# マンション購入 vs 賃貸＋投資 シミュレーター

東京23区の高騰するマンション市況を踏まえ、**1.4億円マンション購入**と**同等の賃貸＋インデックス投資**を10年間で比較するシミュレーターです。

## 機能

- 購入・賃貸の各種前提条件をスライダーで自由に変更
- 純資産推移・月次支出のグラフ表示
- 損益分岐点（何%上昇なら購入が有利か）を自動計算
- スマホ対応レスポンシブUI

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## GitHub → Vercel デプロイ手順

1. このフォルダをGitHubリポジトリにプッシュ
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/mansion-simulator.git
   git push -u origin main
   ```

2. [vercel.com](https://vercel.com) にログイン → **New Project**

3. GitHubリポジトリをインポート

4. Framework Preset: **Next.js** （自動検出される）

5. **Deploy** ボタンをクリック → 完了！

## 技術スタック

- **Next.js 14** (App Router)
- **TypeScript**
- **Recharts** (グラフ描画)
- Google Fonts (Noto Serif JP / Noto Sans JP / DM Mono)

## 前提条件・計算ロジック

元記事（@pageturner_and）の前提条件をベースに実装：

- ローン：元利均等・段階的金利（1-3年: 1.5% → 4-6年: 1.75% → 7年〜: 2.0%）
- 住宅ローン控除（ZEH）年31.5万円、固定資産税年20万円との差額を投資
- 賃貸側：毎月の差額（購入コスト - 家賃）を年7%インデックス投資（NISA・複利）
- 売却：3,000万円特別控除適用、売却コスト4%
- 損益分岐点：二分探索で自動計算

## ライセンス

MIT
