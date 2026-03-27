import knowledge from "@/content/chat/knowledge.v1.json"

type KnowledgePack = {
  id: string
  label: string
  entries: string[]
}

type ChatKnowledge = {
  version: string
  productName: string
  packs: KnowledgePack[]
}

const typedKnowledge = knowledge as ChatKnowledge

export const CHAT_KNOWLEDGE_VERSION = typedKnowledge.version

export function getKnowledgePacks(): KnowledgePack[] {
  return typedKnowledge.packs
}

export function serializeKnowledgeForPrompt() {
  return getKnowledgePacks()
    .map((pack) => {
      const lines = pack.entries.map((entry, index) => `${index + 1}. ${entry}`).join("\n")
      return `[${pack.label}]\n${lines}`
    })
    .join("\n\n")
}
