import Anthropic from "@anthropic-ai/sdk"

function getAnthropicCompatibleConfig(): {
  apiKey: string | undefined
  baseURL: string | undefined
} {
  return {
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: process.env.MINIMAX_ANTHROPIC_BASE_URL ?? "https://api.minimax.io/anthropic",
  }
}

export function getTextModel(): string {
  return process.env.MINIMAX_TEXT_MODEL ?? "MiniMax-M2.7"
}

export function createLlm() {
  const { apiKey, baseURL } = getAnthropicCompatibleConfig()
  return new Anthropic({ apiKey, baseURL })
}

export const llm = createLlm()

