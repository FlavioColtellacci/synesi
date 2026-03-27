# Synesi Chatbot Rollout

## Goal

Ship a reliable in-dashboard assistant that helps users complete Synesi workflows faster, while keeping response quality and trust high.

## Rollout Phases

### Phase 1: MVP (week 1)

- Enable chatbot launcher and panel on authenticated `/app/*` pages.
- Launch authenticated `POST /api/chat` backed by MiniMax.
- Use curated Synesi knowledge packs and safety prompt contract.
- Track baseline events:
  - `chat_widget_open`
  - `chat_message_sent`
  - `chat_response_received`
  - `chat_feedback_positive`
  - `chat_feedback_negative`
  - `chat_handoff_requested`

### Phase 2: Quality Improvements (week 2)

- Tune prompt and knowledge pack entries based on top missed intents.
- Improve follow-up actions for common journeys:
  - creating thesis
  - status updates
  - trusted sources
  - alert preferences
  - billing help
- Review server logs for high-latency or repeated parse failures.

### Phase 3: Actionable Assistant (post-MVP)

- Add explicit action confirmation flows before any write intent.
- Expand intent handling for thesis-specific guidance.
- Add support handoff workflow and owner notifications.

## Success Metrics

- Usage: at least 30% of active dashboard users open the chatbot in 30 days.
- Quality: at least 60% positive feedback vs. total feedback actions.
- Support impact: at least 25% drop in repeat "how do I..." support questions.
- Performance: p95 response latency at or below 4 seconds for MVP.

## Weekly Ops Checklist

- Export and review chat event totals by week.
- Identify top unanswered or low-confidence intents.
- Update `content/chat/knowledge.v1.json` with corrected guidance.
- Verify no hallucination regressions in sampled conversations.
- Review handoff requests and decide next product/doc improvements.
