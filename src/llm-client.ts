export type LLMProvider = "anthropic" | "openai";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

const DEFAULT_PROMPT =
  "Write a concise alt-text description of this image for use in a Markdown document. Be specific and factual. One or two sentences.";

export async function captionImage(
  imageBytes: Uint8Array,
  mimeType: string,
  config: LLMConfig,
  prompt = DEFAULT_PROMPT
): Promise<string> {
  const model = config.model || DEFAULT_MODELS[config.provider];
  const b64 = uint8ToBase64(imageBytes);

  if (config.provider === "anthropic") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: b64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`Anthropic API ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return data.content?.[0]?.text?.trim() ?? "";
  }

  // OpenAI
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
