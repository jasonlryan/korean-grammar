import OpenAI from "openai";
import dotenv from "dotenv";
// Ensure env is loaded in local dev; on Vercel env is provided automatically
dotenv.config();

export default async function handler(req, res) {
  // CORS (allow local dev)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Create client at request time so env is guaranteed to be loaded
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const {
      pattern,
      description = "",
      tip = "",
      existingExample = "",
    } = req.body || {};

    if (!pattern) {
      return res.status(400).json({ error: "Missing 'pattern' in body" });
    }

    const prompt = `You are a Korean language expert. Generate 5 diverse, natural Korean example sentences using the grammar pattern "${pattern}".

Context:
- Pattern: ${pattern}
- Description: ${description}
- Usage tip: ${tip}
- Existing example: ${existingExample}

Requirements:
1. Create 5 completely different Korean sentences using "${pattern}"
2. Each sentence should be natural and commonly used
3. Vary the topics (daily life, work, relationships, hobbies, etc.)
4. Include different formality levels where appropriate
5. Provide clear English translations
6. Make sure each example distinctly demonstrates the pattern usage

Return ONLY a JSON array in this exact format:
[
  { "korean": "…", "english": "…" },
  { "korean": "…", "english": "…" },
  { "korean": "…", "english": "…" },
  { "korean": "…", "english": "…" },
  { "korean": "…", "english": "…" }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a Korean language expert specializing in advanced grammar patterns. You provide accurate, natural Korean examples with precise English translations.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "[]";
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      return res
        .status(502)
        .json({ error: "Invalid JSON from model", raw: content });
    }
    if (!Array.isArray(data) || data.length !== 5) {
      return res.status(502).json({ error: "Unexpected format", raw: data });
    }
    return res.status(200).json({ examples: data });
  } catch (err) {
    console.error("/api/generate-examples error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
