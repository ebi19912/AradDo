import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getAISettings() {
  let settings = await prisma.aISetting.findFirst();
  if (!settings) {
    settings = await prisma.aISetting.create({
      data: {
        provider: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.GEMINI_API_KEY || "", // migrate any existing env key initially
        model: "anthropic/claude-sonnet-4",
        temperature: 0.7,
        maxTokens: 8000,
      }
    });
  }
  return settings;
}
