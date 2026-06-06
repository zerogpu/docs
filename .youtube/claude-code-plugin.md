# YouTube Video Description: ZeroGPU Claude Code Plugin

> Copy everything below the divider into the YouTube description box.

## Title

Run Claude Code Skills on ZeroGPU's Nano Models (PII Redaction, Classification & More)

---

In this video I install the zerogpu-router plugin for Claude Code and show how it turns every ZeroGPU command into a Claude Code skill. Claude can auto-invoke them, or you can call them directly by name (like /zerogpu-router:redact-pii), to offload cheap, well-defined tasks like PII redaction, classification, and entity extraction to ZeroGPU's edge-optimized nano language models, without leaving your terminal.

Why it matters: keep raw PII out of Claude's context, cut token spend on routine NLP work, and route the easy cases to a faster, cheaper model while Claude handles the hard ones.

⚡ Quick install (run inside a Claude Code session)
/plugin marketplace add zerogpu/zerogpu-router
/plugin install zerogpu-router@zerogpu
/reload-plugins

🔗 Featured in this video
Claude Code Plugin guide: https://docs.zerogpu.ai/integrations/claude-code-plugin
Get your API key (Dashboard): https://platform.zerogpu.ai/dashboard
Model Catalog: https://docs.zerogpu.ai/docs/model-catalog
Quickstart (first API call in 5 min): https://docs.zerogpu.ai/docs/quickstart
All Integrations: https://docs.zerogpu.ai/integrations/index

🛠️ Skills shown in the video
redact-pii: mask PII in-line with [LABEL] placeholders
extract-pii: pull PII out as structured JSON
classify-structured: multi-axis classification (sentiment, topic, etc.)
classify-zero-shot: classify against your own labels
classify-iab / classify-iab-enriched: IAB ad-tech taxonomy
extract-entities: custom-label named-entity recognition
extract-json: schema-driven field extraction
chat / chat-thinking: short single-turn replies
summarize: condense long passages

📚 Documentation
Docs home: https://docs.zerogpu.ai
Introduction: https://docs.zerogpu.ai/index
API Reference: https://docs.zerogpu.ai/api-reference/introduction
Responses Endpoint: https://docs.zerogpu.ai/api-reference/endpoint/responses
Chat Completions Endpoint: https://docs.zerogpu.ai/api-reference/endpoint/chat-completions
Batch API: https://docs.zerogpu.ai/api-reference/batch/index
Cookbook: https://docs.zerogpu.ai/cookbook/index
FAQ: https://docs.zerogpu.ai/faq

🧠 Core Concepts
Nano Language Models: https://docs.zerogpu.ai/concepts/nano-language-models
Distributed Inference: https://docs.zerogpu.ai/concepts/distributed-inference
Geo-Aware Routing: https://docs.zerogpu.ai/concepts/geo-aware-routing

💻 SDK Examples
Python: https://docs.zerogpu.ai/sdks/python
JavaScript: https://docs.zerogpu.ai/sdks/javascript
Rust: https://docs.zerogpu.ai/sdks/rust
Go: https://docs.zerogpu.ai/sdks/go
Ruby: https://docs.zerogpu.ai/sdks/ruby

🧰 Prerequisites
Node.js 20 or newer
Claude Code: npm install -g @anthropic-ai/claude-code
ZeroGPU CLI: npm install -g zerogpu-cli

🔗 Connect with us
Website: https://zerogpu.ai
Platform: https://platform.zerogpu.ai
GitHub: https://github.com/zerogpu
Discord: https://discord.gg/Ad5KZvAyky
X (Twitter): https://x.com/ZeroGPU_AI

#ZeroGPU #ClaudeCode #AI #LLM #DeveloperTools #PII #NLP #Anthropic #Inference
