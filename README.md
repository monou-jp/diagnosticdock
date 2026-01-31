# DiagnosticDock

既存サイトに &lt;script&gt; 1行で埋め込める、超軽量な診断・分岐ウィジェット（Vanilla JavaScript / 依存なし / 1ファイル完結）。

- LP / コーポレート / WordPress / 静的サイトに後付けで導入
- 診断 → 結果 → CTA（問い合わせ・予約）までを最短でつなぐ
- サーバー不要（状態管理と結果生成はブラウザ内で完結）
- ES5寄りの実装方針で古め環境にも配慮

---

## デモ

以下のURLより、実際の動作を確認できるデモページをご覧いただけます。

[https://monou-jp.github.io/diagnosticdock/](https://monou-jp.github.io/diagnosticdock/)


ローカルで確認する場合は、`docs/index.html` をブラウザで開いてください。

---

## 特徴

- Vanilla JavaScript / 依存ライブラリなし
- 1ファイル完結（HTML/CSS/JS を JS 内で生成）
- embed / modal 両対応
- 単一選択 / 複数選択（multi）
- 条件分岐（option.next / step.next）
- 進捗表示（バー / テキスト）
- 結果表示（items / payload / CTA）
- 戻る / リセット
- hooks（計測・連携用）
- theme（密度・角丸・サイズなど）

---

## なぜ「サーバー不要」なのか

DiagnosticDock は、診断の進行状態と結果生成をすべてブラウザ内で行います。

- 既存の問い合わせフォーム・予約ページをそのまま利用可能
- 管理画面や DB 不要
- 後付け導入・撤去が容易

---

## インストール

### script 読み込み

```html
&lt;script src="/diagnosticdock.js" defer&gt;&lt;/script&gt;
```

---

## 最小例

```html
&lt;div id="diagnosis"&gt;&lt;/div&gt;

&lt;script&gt;
diagnosticDock({
mount: "#diagnosis",
title: "簡易診断",
steps: [
{
id: "site_type",
question: "どのようなサイトですか？",
options: [
{ label: "コーポレート", value: "corp" },
{ label: "LP", value: "lp" }
]
}
],
result: function (answers) {
return {
title: "診断結果",
description: "おすすめプランはこちらです。",
ctaLabel: "問い合わせる",
ctaUrl: "/contact?type=" + answers.site_type
};
}
});
&lt;/script&gt;
```

---

## 条件分岐

### option.next

```js
{
id: "need_lp",
question: "LPは必要ですか？",
options: [
{ label: "はい", value: "yes", next: "detail" },
{ label: "いいえ", value: "no", next: "end" }
]
}
```

### step.next（ルール）

```js
next: [
{ when: { id: "budget", eq: "low" }, goto: "light_plan" },
{ goto: "end" }
]
```

---

## CSP / 動作しない場合

- script-src が外部 JS をブロックしていないか確認
- style-src が厳しすぎる場合、見た目が適用されないことがあります

例（概念）:
```txt
Content-Security-Policy:
script-src 'self';
style-src 'self' 'unsafe-inline';
```

---

## 注意点

- 表示される金額は正式見積ではありません
- 回答内容はブラウザ内でのみ保持されます
- 個人情報はフォーム側で入力する運用を推奨

---

## 制作・開発

DiagnosticDock は 門王（https://monou.jp）が制作しています。

- 診断・分岐ウィジェットの開発
- 既存サイトへの後付け実装
- 制作会社向けのカスタマイズ対応

開発相談:
https://monou.jp/contact

---

## License
BSD-3-Clause
&lt;/textarea&gt;
