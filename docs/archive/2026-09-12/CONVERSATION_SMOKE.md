> Bản lưu lịch sử, không phải quy định hiện hành. Xem [mục lục đang dùng](../../README.md). Không đọc mặc định.

# Conversation smoke — 2026-09-12

User approved at most 10 Gemini generateContent requests, synthetic data only, model gemini-3.5-flash-lite. No cloud mutation, no paid fallback, no retries. Stop on quota/auth/model errors.

Budget: all 10 slots reserved and consumed, 10/10 requests completed successfully. No retries, remaining budget 0. Prompt conversation-c1-v1, code checkpoint 453595f. Historical project requests now 41 (31 previous +10 here); no authority for further requests from this budget.

## Method

Actual generateConversation adapter, fixed synthetic task task-en (bài tiếng Anh), focus task-en, reference time 2026-09-12 08:00 Vietnam, empty memory/history. One request per independent case, 16-second spacing, timeout 5 seconds. Outputs passed through conversationChat with a fake read store to inspect planned changes; NO D1 commit or external mutation. Fake sameTitleTasks returns empty, so this run does not test duplicate-title confirmation. Case1 contains a title already in context: not a clean new-task case. Expected kind is a test target, not ground truth in ambiguous cases.

## Results

| Case | Input / focus | Model kind | Backend result | Model latency ms |
| --- | --- | --- | --- | --- |
| 1 | Tớ có bài tiếng Anh, deadline ngày mai (existing title) | deadline | Blocked by directRequest, generic clarification, no mutation | 1275 |
| 2 | Thêm task làm btvn tiếng anh, dl ngày mai | capture | Plans one task with date-only 13/09, no confirmation buttons | 1221 |
| 3 | Đổi hạn bài tiếng Anh thành 18/09/2026 | deadline | Plans version-guarded deadline update | 1080 |
| 4 | Mai 9h nhắc tớ làm bài ấy nhé | remind | Plans appointment at 13/09 09:00, no invented duration | 1109 |
| 5 | Tối nay mệt quá, chẳng muốn làm gì | chat | No mutation; supportive but suggests leaving it to tomorrow without checking urgency | 1135 |
| 6 | Dừng nhắc hôm nay nhé | rest | Plans pause until end of Vietnam day | 1274 |
| 7 | Tớ làm xong bài tiếng Anh rồi | complete | Plans task completion with expected version | 1163 |
| 8 | Xong rồi | complete | Blocked correctly, but generic clarification mismatches user's situation | 1041 |
| 9 | Hôm nay còn việc gì? | overview | DB-based overview says no scheduled sessions, lists known task | 1012 |
| 10 | Ví dụ tớ nói tớ có bài văn hạn ngày mai, thì cậu hiểu sao? | chat | No mutation, but model asks if user wants to save without creating pending confirmation | 1125 |

Case2 model reply claimed it already saved, contrary to prompt. Backend discarded that reply and generated success text for the plan; actual sending depends on commit. Prompt alone is insufficient to prevent unsupported success claims.

## Verdict and next changes

- All 10 outputs conform to schema. Mean model latency 1143.5 ms, range 1012–1275 ms. Provider reported total 5936 tokens. Excludes 16-second pacing and real Telegram/D1/context latency. Not a production SLA or free-tier capacity proof.
- 8/10 kinds matched the prewritten targets, but case1 is ambiguous due to existing title; do not present 80% as general accuracy. Case8 is a genuine mismatch: model chooses complete while its reply asks confirmation. Backend blocks mutation but loses useful clarification.
- In these 10 independent synthetic probes there was no unauthorized planned mutation. This is not a safety guarantee or end-to-end DB proof. No multi-turn live pending confirmation, no real calendar, no persisted mutation tested here.
- Suitable to continue a bounded personal pilot after targeted fixes; not ready to claim natural autonomous companion or complete the full plan.
- Fix application clarification routing: complete + insufficient evidence asks task vs session; existing-title capture/update ambiguity asks whether existing task or another task. Do not loosen execution guards to make these probes pass.
- Clarification must persist a bounded pending request and accept the user's next answer. Social output inviting action (case10) must not promise an unsupported follow-up path. Confirmation scope/evidence comes from user + validated pending state, not the model's own suggestion.
- Persona: support fatigue without blanket postponement or empty praise; action replies should be concise and natural but derived from committed result. Do not call model again merely to rewrite a success sentence.
- Remaining deployment gates unchanged: migration0009 not remote, AI off, no actual reminder pilot, full conversation behavior not yet complete. Next live call needs a new explicit request budget, not another automatic prompt sweep.
