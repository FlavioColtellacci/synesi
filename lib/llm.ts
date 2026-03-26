import Anthropic from "@anthropic-ai/sdk"

export type LlmProvider = "anthropic" | "minimax"

function getProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase().trim()
  if (raw === "minimax") return "minimax"
  return "anthropic"
}

function getAnthropicCompatibleConfig(provider: LlmProvider): {
  apiKey: string | undefined
  baseURL: string | undefined
} {
  if (provider === "minimax") {
    return {
      apiKey: process.env.MINIMAX_API_KEY ?? process.env.ANTHROPIC_API_KEY,
      baseURL:
        process.env.MINIMAX_ANTHROPIC_BASE_URL ??
        process.env.ANTHROPIC_BASE_URL ??
        "https://api.minimax.io/anthropic",
    }
  }

  return {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  }
}

export function getTextModel(provider: LlmProvider = getProvider()): string {
  if (provider === "minimax") {
    return process.env.MINIMAX_TEXT_MODEL ?? "MiniMax-M2.7"
  }

  return process.env.ANTHROPIC_TEXT_MODEL ?? "claude-sonnet-4-6"
}

export function createLlm(provider: LlmProvider = getProvider()) {
  const { apiKey, baseURL } = getAnthropicCompatibleConfig(provider)
  return new Anthropic({ apiKey, baseURL })
}

export const llm = createLlm()

