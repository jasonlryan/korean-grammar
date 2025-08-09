#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateExamples(pattern, description, tip, existingExample) {
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
  {
    "korean": "Korean sentence here",
    "english": "English translation here"
  },
  {
    "korean": "Korean sentence here", 
    "english": "English translation here"
  },
  {
    "korean": "Korean sentence here",
    "english": "English translation here"
  },
  {
    "korean": "Korean sentence here",
    "english": "English translation here"
  },
  {
    "korean": "Korean sentence here",
    "english": "English translation here"
  }
]`;

  try {
    console.log(`Generating examples for pattern: ${pattern}`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Note: gpt-4.1-mini doesn't exist, using gpt-4o-mini
      messages: [
        {
          role: "system",
          content:
            "You are a Korean language expert specializing in advanced grammar patterns. You provide accurate, natural Korean examples with precise English translations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content.trim();

    // Try to parse the JSON response
    try {
      const examples = JSON.parse(response);
      if (Array.isArray(examples) && examples.length === 5) {
        return examples;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", response);
      throw new Error("Invalid JSON response from OpenAI");
    }
  } catch (error) {
    console.error(`Error generating examples for ${pattern}:`, error.message);
    return null;
  }
}

async function main() {
  // Check for required environment variable
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY not found in .env file");
    process.exit(1);
  }

  // Read grammar data
  const grammarData = JSON.parse(readFileSync("grammar.json", "utf8"));

  // Get pattern from command line argument or generate for a specific pattern
  const targetPattern = process.argv[2];

  if (targetPattern) {
    // Generate examples for a specific pattern
    const item = grammarData.items.find(
      (item) => item.pattern === targetPattern
    );
    if (!item) {
      console.error(`Pattern "${targetPattern}" not found in grammar.json`);
      process.exit(1);
    }

    console.log(`Generating examples for pattern: ${targetPattern}`);
    const examples = await generateExamples(
      item.pattern,
      item.description || "",
      item.tip || "",
      item.example || ""
    );

    if (examples) {
      // Add examples to the item
      item.generatedExamples = examples;

      // Save updated data
      writeFileSync("grammar.json", JSON.stringify(grammarData, null, 2));
      console.log(
        `✅ Generated ${examples.length} examples for ${targetPattern}`
      );
      console.log("Examples:");
      examples.forEach((ex, i) => {
        console.log(`${i + 1}. ${ex.korean}`);
        console.log(`   ${ex.english}\n`);
      });
    } else {
      console.error(`❌ Failed to generate examples for ${targetPattern}`);
    }
  } else {
    // Generate examples for patterns that don't have them yet
    let generatedCount = 0;
    const patternsWithoutExamples = grammarData.items.filter(
      (item) => !item.generatedExamples
    );

    console.log(
      `Found ${patternsWithoutExamples.length} patterns without generated examples`
    );

    // Process first 5 patterns to avoid hitting rate limits
    const patternsToProcess = patternsWithoutExamples.slice(0, 5);

    for (const item of patternsToProcess) {
      const examples = await generateExamples(
        item.pattern,
        item.description || "",
        item.tip || "",
        item.example || ""
      );

      if (examples) {
        item.generatedExamples = examples;
        generatedCount++;
        console.log(`✅ Generated examples for ${item.pattern}`);
      } else {
        console.log(`❌ Failed to generate examples for ${item.pattern}`);
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (generatedCount > 0) {
      // Save updated data
      writeFileSync("grammar.json", JSON.stringify(grammarData, null, 2));
      console.log(
        `\n🎉 Successfully generated examples for ${generatedCount} patterns`
      );
    }

    if (patternsWithoutExamples.length > 5) {
      console.log(
        `\nNote: ${
          patternsWithoutExamples.length - 5
        } patterns remaining. Run again to continue.`
      );
    }
  }
}

main().catch(console.error);
