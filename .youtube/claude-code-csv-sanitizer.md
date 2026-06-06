# YouTube Video Description: Claude Code CSV Sanitizer

> Copy everything below the divider into the YouTube description box.

## Title

Redact PII from a CSV with One Prompt: Claude Code + ZeroGPU Nano Models

---

Watch Claude Code scrub personal data out of a raw CSV export in a single natural-language prompt. You hand Claude a customer-feedback CSV full of names, emails, and phone numbers, and you get back two files: a clean copy that is safe to share, and a PII audit log of exactly what was removed and where. Claude orchestrates the file work while ZeroGPU's PII-aware nano models do the high-volume redaction, so raw PII never has to live in your transcript.

Why it matters: doing this by hand is error-prone and regex is brittle. This recipe redacts consistently across every row with a purpose-built model, and gives compliance an auditable trail of what was scrubbed.

⚡ Quick install
npm install -g zerogpu-cli
npm install -g @anthropic-ai/claude-code

Then, inside a Claude Code session:
/plugin marketplace add zerogpu/zerogpu-router
/plugin install zerogpu-router@zerogpu
/reload-plugins
/zerogpu-router:signin

🔗 Featured in this video
CSV Sanitizer cookbook: https://docs.zerogpu.ai/cookbook/claude-code-csv-sanitizer
Claude Code plugin guide: https://docs.zerogpu.ai/integrations/claude-code-plugin
Get your API key (Dashboard): https://platform.zerogpu.ai/dashboard
Model catalog: https://docs.zerogpu.ai/docs/model-catalog
Quickstart: https://docs.zerogpu.ai/docs/quickstart

🛠️ Skills shown
redact-pii (mask PII in-line as [PERSON], [EMAIL], [PHONE_NUMBER])
extract-pii (itemize PII entities as structured JSON for the audit log)
extract-entities (catch domain-specific IDs with your own labels)

📚 Documentation
Docs home: https://docs.zerogpu.ai
API reference: https://docs.zerogpu.ai/api-reference/introduction
Batch API: https://docs.zerogpu.ai/api-reference/batch/index
More cookbooks: https://docs.zerogpu.ai/cookbook/index
FAQ: https://docs.zerogpu.ai/faq

🧠 Core Concepts
Nano language models: https://docs.zerogpu.ai/concepts/nano-language-models
Distributed inference: https://docs.zerogpu.ai/concepts/distributed-inference
Geo-aware routing: https://docs.zerogpu.ai/concepts/geo-aware-routing

💻 SDK Examples
Python: https://docs.zerogpu.ai/sdks/python
JavaScript: https://docs.zerogpu.ai/sdks/javascript
Rust: https://docs.zerogpu.ai/sdks/rust
Go: https://docs.zerogpu.ai/sdks/go
Ruby: https://docs.zerogpu.ai/sdks/ruby

🧰 Connect with us
Website: https://zerogpu.ai
Platform: https://platform.zerogpu.ai
GitHub: https://github.com/zerogpu
Discord: https://discord.gg/Ad5KZvAyky
X: https://x.com/ZeroGPU_AI

#ZeroGPU #ClaudeCode #Anthropic #PII #AI #LLM #DeveloperTools #DataPrivacy #Redaction
