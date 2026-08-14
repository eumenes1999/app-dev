// Supabaseダッシュボード > Edge Functions からデプロイ、または
// `supabase functions deploy summarize-notes` を実行してください(要Supabase CLI)。
// 実行前に `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` でAPIキーをシークレット登録すること。
// クライアント(app.js)からは supabase.functions.invoke('summarize-notes', { body: { notes: [...] } }) で呼び出す想定。

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-haiku-4-5";

// このFunctionはanon keyさえあれば誰でも(このアプリ経由でなくても)直接呼び出せるため、
// 悪意あるリクエストで入力トークン課金を無制限に消費されないよう上限を設ける
const MAX_NOTES = 50;
const MAX_NOTE_LENGTH = 500;
const MAX_TOTAL_LENGTH = 6000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEYがサーバー側に設定されていません" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let notes: string[];
  try {
    const body = await req.json();
    notes = Array.isArray(body.notes)
      ? body.notes
          .filter((t: unknown) => typeof t === "string" && t.trim())
          .slice(0, MAX_NOTES)
          .map((t: string) => t.trim().slice(0, MAX_NOTE_LENGTH))
      : [];
  } catch {
    return new Response(
      JSON.stringify({ error: "リクエストボディが不正です" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (notes.length === 0) {
    return new Response(
      JSON.stringify({ summary: "要約する付箋がまだありません。" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const notesList = notes.map((t, i) => `${i + 1}. ${t}`).join("\n").slice(0, MAX_TOTAL_LENGTH);
  const prompt =
    `以下は複数人が共同編集の付箋ボードに書いたメモです。要点を3〜5行程度で日本語で要約してください。箇条書きで、誰が書いたかの推測は含めないでください。\n\n${notesList}`;

  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    console.error("Anthropic API error", anthropicResp.status, errText);
    return new Response(
      JSON.stringify({ error: "AI要約の生成に失敗しました" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await anthropicResp.json();
  const summary = (data.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("\n");

  return new Response(
    JSON.stringify({ summary }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
