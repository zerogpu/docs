// Global custom script (Mintlify injects every .js in the content dir on every
// page as a <script> tag). It fetches the ZeroGPU model catalog ONCE on app
// load and caches it on `window.__zgpuModels`.
//
// Caching behavior this gives us for free:
// - Runs once per full page load (hard load / refresh).
// - Does NOT re-run on client-side (SPA) navigation, so every page reuses the
//   same cached data with no refetch.
// - A hard refresh reloads the document and re-runs this script -> one fresh
//   fetch. That is the intended "refetch on refresh, reuse on navigation".
//
// Shape of the cache:
//   window.__zgpuModels = { data: <models[]|null>, promise: <Promise> }
// Consumers (see docs/model-catalog.mdx) read `.data` immediately if present,
// otherwise await `.promise`, otherwise listen for the "zgpu:models-loaded"
// event in case they mounted before this script created the store.
//
// Request/response EXAMPLES on the task pages (docs/ad-tech.mdx etc.) are driven
// by MODEL_EXTRAS below. The API only carries ONE request sample per model and
// no response samples at all, so the example OUTPUTS (and, for the multi-use-case
// PII models plus deberta, the example INPUTS too) are hardcoded here and
// attached to each model as `m.examples`. Single-example models leave
// `responsesBody`/`chatBody` unset and fall back to the API sample bodies.

(function () {
  if (typeof window === "undefined") return;

  var ZGPU_MODELS_URL = "https://api-dashboard.zerogpu.ai/api/models";

  var store = window.__zgpuModels || (window.__zgpuModels = {});

  // Already fetched (or fetching) this page load -> nothing to do.
  if (store.data || store.promise) return;

  // Per-model example data that does NOT exist in the catalog API. Keyed by
  // modelId. Each entry is an ordered list of examples; the task pages render
  // one section per model and one Request/Response pair per example.
  //   title         optional sub-heading (multi-use-case models only)
  //   requestNote   optional prose above the request (backticks -> <code>)
  //   responsesBody optional Responses API body override (else API sample)
  //   chatBody      optional Chat Completions body override (else API sample)
  //   responseNote  optional prose above the response
  //   responseLang  "json" | "text"
  //   output        the response body, verbatim, as a string
  var MODEL_EXTRAS = {
    "zlm-v1-iab-classify-edge": {
      examples: [
        {
          responseNote:
            "Returns IAB `audience` categories plus `content` matches across taxonomy versions, each with a confidence score.",
          responseLang: "json",
          output: [
            "{",
            '  "audience": [',
            '    { "name": "Technology & Computing", "score": 0.7686 },',
            '    { "name": "Consumer Electronics", "score": 0.7206 },',
            '    { "name": "65-69", "score": 0.5950 }',
            "  ],",
            '  "content": {',
            '    "iab_1_0": [',
            '      { "name": "Cell Phones", "score": 0.7597 },',
            '      { "name": "Technology & Computing", "score": 0.7387 }',
            "    ],",
            '    "iab_2_2": [',
            '      { "name": "Smartphones", "score": 0.7597 },',
            '      { "name": "Wearable Technology", "score": 0.7387 },',
            '      { "name": "Technology & Computing", "score": 0.7109 }',
            "    ]",
            "  }",
            "}",
          ].join("\n"),
        },
      ],
    },
    "zlm-v1-iab-classify-edge-enriched": {
      examples: [
        {
          responseNote:
            "In addition to scored `audience` and `content` categories, the enriched model returns taxonomy codes and parent IDs, plus `topics`, `keywords`, and an inferred `user_intent`.",
          responseLang: "json",
          output: [
            "{",
            '  "audience": [',
            "    {",
            '      "id": 687,',
            '      "parent_id": 206,',
            '      "name": "Technology & Computing",',
            '      "tier1_name": "Interest",',
            '      "tier2_name": "Technology & Computing",',
            '      "score": 0.7686',
            "    },",
            "    {",
            '      "id": 703,',
            '      "parent_id": 687,',
            '      "name": "Consumer Electronics",',
            '      "tier1_name": "Interest",',
            '      "tier2_name": "Technology & Computing",',
            '      "tier3_name": "Consumer Electronics",',
            '      "score": 0.7206',
            "    }",
            "  ],",
            '  "content": {',
            '    "iab_1_0": [',
            '      { "code": "IAB19-6", "name": "Cell Phones", "tier": 2, "parent_code": "IAB19", "score": 0.7597 },',
            '      { "code": "IAB19", "name": "Technology & Computing", "tier": 1, "parent_code": null, "score": 0.7387 }',
            "    ]",
            "  },",
            '  "topics": [',
            '    { "name": "smartphones", "score": 0.7597 },',
            '    { "name": "wearable technology", "score": 0.7387 },',
            '    { "name": "technology & computing", "score": 0.7109 }',
            "  ],",
            '  "keywords": ["technology", "reshaped", "everyday", "routines", "quietly", "weaving", "rhythm", "itself", "life", "into"],',
            '  "user_intent": {',
            '    "name": "mastering technology quietly reshaped rhythm everyday life",',
            '    "category": "informational",',
            '    "score": 0.5',
            "  }",
            "}",
          ].join("\n"),
        },
      ],
    },
    // deberta's API sample only lists three labels; the documented example
    // classifies into "technology", so the request is overridden here to keep
    // the input and the hardcoded output coherent.
    "deberta-v3-small": {
      examples: [
        {
          responsesBody: {
            model: "deberta-v3-small",
            input:
              "Apple is expected to unveil its next-generation M5 chip at WWDC this June, promising a 40% boost in GPU performance and a new dedicated AI core for on-device machine learning tasks.",
            instructions: "[sports, finance, politics, technology]",
          },
          chatBody: {
            model: "deberta-v3-small",
            messages: [
              { role: "system", content: "[sports, finance, politics, technology]" },
              {
                role: "user",
                content:
                  "Apple is expected to unveil its next-generation M5 chip at WWDC this June, promising a 40% boost in GPU performance and a new dedicated AI core for on-device machine learning tasks.",
              },
            ],
          },
          responseNote: "Returns each candidate label with a probability score.",
          responseLang: "json",
          output: [
            "{",
            '  "technology": 0.971784,',
            '  "politics": 0.011858,',
            '  "sports": 0.01175,',
            '  "finance": 0.004608',
            "}",
          ].join("\n"),
        },
      ],
    },
    "llama-3.1-8b-instruct-fast": {
      examples: [
        {
          responseNote:
            "The summary is returned as `output[].content[].text` (Responses API) or `choices[].message.content` (Chat Completions).",
          responseLang: "text",
          output:
            "The global semiconductor industry is undergoing a significant transformation driven by geopolitical tensions, surging demand from artificial intelligence workloads, and government-backed industrial policies. A race to onshore chip manufacturing capacity is underway, with the US, Europe, and Asia investing heavily in domestic fabrication, while companies like TSMC, Intel, and Samsung are building new fabs in the US. However, construction timelines have slipped, costs have increased, and a shortage of skilled workers has prompted some manufacturers to bring in overseas engineers. The demand for chips has also changed, with AI model training and inference driving a shortage of graphics processing units, particularly those made by NVIDIA. In response, companies like Google, Amazon, and Meta are investing in custom silicon to reduce dependence on third-party supply chains. The US has tightened export controls on advanced chips and equipment destined for China, which has responded with increased state investment in its domestic semiconductor ecosystem. The equipment layer, particularly ASML's near-monopoly on extreme ultraviolet lithography machines, may prove to be the most consequential chokepoint in the industry.",
        },
      ],
    },
    "LFM2.5-1.2B-Instruct": {
      examples: [
        {
          responseLang: "text",
          output:
            "That's an amazing accomplishment! Keep up the great work, each step brings you closer to your goals. You're stronger than you think!\n\nWould you like tips to help you keep improving?",
        },
      ],
    },
    "LFM2.5-1.2B-Thinking": {
      examples: [
        {
          responseNote: "The model returns its answer alongside an explicit reasoning trace.",
          responseLang: "text",
          output:
            "The capital of Japan is **Tokyo**.\n\n**Reasoning:**\n1. Japan's political, cultural, and economic center is located in Tokyo.\n2. Historically, Tokyo has served as Japan's...",
        },
      ],
    },
    "zlm-v1-followup-questions-edge": {
      examples: [
        {
          responseNote: "The model returns follow-up questions a reader might naturally ask next.",
          responseLang: "text",
          output:
            "How long does an EV battery typically last before it needs to be replaced?\nWhat happens to electric vehicle batteries at the end of their life, and how recyclable are they?\nIs the current power grid ready to handle widespread EV charging demand?",
        },
      ],
    },
    "gliner-multi-pii-v1": {
      examples: [
        {
          title: "Redaction",
          requestNote:
            "Set `metadata.usecase` to `redact` and `metadata.mask` to `label` to replace detected PII in place with `[LABEL]` placeholders.",
          responsesBody: {
            model: "gliner-multi-pii-v1",
            input:
              "Hello Jane Doe, this is John Doe reaching out regarding my recent order. If you need any additional details, feel free to call me at 415-555-0134 during business hours. You can also email me at hi@example.com, and I will respond as soon as possible.",
            metadata: { mask: "label", usecase: "redact" },
          },
          chatBody: {
            model: "gliner-multi-pii-v1",
            messages: [
              {
                role: "user",
                content:
                  "Hello Jane Doe, this is John Doe reaching out regarding my recent order. If you need any additional details, feel free to call me at 415-555-0134 during business hours. You can also email me at hi@example.com, and I will respond as soon as possible.",
              },
            ],
            metadata: { mask: "label", usecase: "redact" },
          },
          responseLang: "json",
          output: [
            "{",
            '  "redacted_text": "Hello [PERSON], this is [PERSON] reaching out regarding my recent order. If you need any additional details, feel free to call me at [PHONE_NUMBER] during business hours. You can also email me at [EMAIL], and I will respond as soon as possible.",',
            '  "entities": [',
            '    { "text": "Jane Doe", "label": "person", "start": 6, "end": 14, "score": 0.9982 },',
            '    { "text": "John Doe", "label": "person", "start": 24, "end": 32, "score": 0.9981 },',
            '    { "text": "415-555-0134", "label": "phone number", "start": 133, "end": 145, "score": 0.9725 },',
            '    { "text": "hi@example.com", "label": "email", "start": 194, "end": 208, "score": 0.9812 }',
            "  ],",
            '  "entities_by_label": {',
            '    "person": ["Jane Doe", "John Doe"],',
            '    "phone number": ["415-555-0134"],',
            '    "email": ["hi@example.com"]',
            "  }",
            "}",
          ].join("\n"),
        },
        {
          title: "Extraction",
          requestNote:
            "Set `metadata.usecase` to `extract-pii` to detect PII without modifying the source text. Narrow results with `categories` and a confidence `threshold`.",
          responsesBody: {
            model: "gliner-multi-pii-v1",
            input: "Contact John Doe at john@example.com or +1-415-555-0134.",
            metadata: { usecase: "extract-pii", threshold: 0.5, categories: ["identity", "contact"] },
          },
          chatBody: {
            model: "gliner-multi-pii-v1",
            messages: [
              { role: "user", content: "Contact John Doe at john@example.com or +1-415-555-0134." },
            ],
            metadata: { usecase: "extract-pii", threshold: 0.5, categories: ["identity", "contact"] },
          },
          responseLang: "json",
          output: [
            "{",
            '  "entities": [',
            '    { "text": "John Doe", "label": "person", "start": 8, "end": 16, "score": 0.9989 },',
            '    { "text": "john@example.com", "label": "email", "start": 20, "end": 36, "score": 0.9776 },',
            '    { "text": "+1-415-555-0134", "label": "phone number", "start": 40, "end": 55, "score": 0.9714 }',
            "  ],",
            '  "entities_by_label": {',
            '    "person": ["John Doe"],',
            '    "email": ["john@example.com"],',
            '    "phone number": ["+1-415-555-0134"]',
            "  }",
            "}",
          ].join("\n"),
        },
      ],
    },
    "gliner2-base-v1": {
      examples: [
        {
          title: "Entity extraction",
          requestNote: "Set `metadata.usecase` to `ner` and pass your own `labels` to extract named entities.",
          responsesBody: {
            model: "gliner2-base-v1",
            input:
              "The application is built with Python 3.11 and uses PostgreSQL 15 for storage. It runs on Kubernetes with Docker containers and communicates via gRPC.",
            metadata: {
              labels: ["programming language", "database", "technology", "protocol"],
              usecase: "ner",
              threshold: 0.3,
            },
          },
          chatBody: {
            model: "gliner2-base-v1",
            messages: [
              {
                role: "user",
                content:
                  "The application is built with Python 3.11 and uses PostgreSQL 15 for storage. It runs on Kubernetes with Docker containers and communicates via gRPC.",
              },
            ],
            metadata: {
              labels: ["programming language", "database", "technology", "protocol"],
              usecase: "ner",
              threshold: 0.3,
            },
          },
          responseLang: "json",
          output: [
            "{",
            '  "entities": {',
            '    "programming language": ["Python 3.11"],',
            '    "database": ["PostgreSQL 15"],',
            '    "technology": ["Kubernetes", "Docker", "gRPC"],',
            '    "protocol": ["gRPC"]',
            "  }",
            "}",
          ].join("\n"),
        },
        {
          title: "Structured JSON extraction",
          requestNote:
            "Set `metadata.usecase` to `json` and define a `schema` of `field::type::description` entries to pull structured records out of free text.",
          responsesBody: {
            model: "gliner2-base-v1",
            input:
              "Best regards, John Smith, Senior Software Engineer at Acme Corp. Phone: (555) 123-4567, Email: john.smith@acme.com, Office: 123 Main Street, Suite 400, San Francisco, CA 94105",
            metadata: {
              schema: {
                contact: [
                  "name::str::Full name",
                  "title::str::Job title",
                  "company::str::Company name",
                  "phone::str::Phone number",
                  "email::str::Email address",
                  "address::str::Office address",
                ],
              },
              usecase: "json",
            },
          },
          chatBody: {
            model: "gliner2-base-v1",
            messages: [
              {
                role: "user",
                content:
                  "Best regards, John Smith, Senior Software Engineer at Acme Corp. Phone: (555) 123-4567, Email: john.smith@acme.com, Office: 123 Main Street, Suite 400, San Francisco, CA 94105",
              },
            ],
            metadata: {
              schema: {
                contact: [
                  "name::str::Full name",
                  "title::str::Job title",
                  "company::str::Company name",
                  "phone::str::Phone number",
                  "email::str::Email address",
                  "address::str::Office address",
                ],
              },
              usecase: "json",
            },
          },
          responseLang: "json",
          output: [
            "{",
            '  "data": {',
            '    "contact": [',
            "      {",
            '        "name": "John Smith",',
            '        "title": "Senior Software Engineer",',
            '        "company": "Acme Corp",',
            '        "phone": "(555) 123-4567",',
            '        "email": "john.smith@acme.com",',
            '        "address": null',
            "      }",
            "    ]",
            "  }",
            "}",
          ].join("\n"),
        },
        {
          title: "Classification",
          requestNote:
            "Set `metadata.usecase` to `classification` and supply a `schema` mapping each axis to its allowed labels.",
          responsesBody: {
            model: "gliner2-base-v1",
            input:
              "I absolutely love this product! The quality is outstanding and the customer service was incredibly helpful.",
            metadata: { schema: { sentiment: ["positive", "negative", "neutral"] }, usecase: "classification" },
          },
          chatBody: {
            model: "gliner2-base-v1",
            messages: [
              {
                role: "user",
                content:
                  "I absolutely love this product! The quality is outstanding and the customer service was incredibly helpful.",
              },
            ],
            metadata: { schema: { sentiment: ["positive", "negative", "neutral"] }, usecase: "classification" },
          },
          responseLang: "json",
          output: ["{", '  "classification": {', '    "sentiment": "positive"', "  }", "}"].join("\n"),
        },
      ],
    },
  };

  // Build the "model library by task" grouping: models grouped by task, plus a
  // curated "Ad Tech" group, ordered to match the docs Models nav. Returns an
  // ordered array of { task, models } so consumers just map over it.
  function buildByTask(models) {
    var AD_TECH_MODELS = [
      "zlm-v1-iab-classify-edge",
      "zlm-v1-iab-classify-edge-enriched",
    ];
    var TASK_ORDER = [
      "Ad Tech",
      "Text Classification",
      "Text Generation",
      "PII",
      "Summarization",
    ];
    var order = [];
    var byTask = {};
    models.forEach(function (m) {
      if (!byTask[m.taskDisplayName]) {
        byTask[m.taskDisplayName] = [];
        order.push(m.taskDisplayName);
      }
      byTask[m.taskDisplayName].push(m);
    });
    var adTech = AD_TECH_MODELS.map(function (id) {
      return models.find(function (m) {
        return m.modelId === id;
      });
    }).filter(Boolean);
    if (adTech.length) {
      byTask["Ad Tech"] = adTech;
      order.push("Ad Tech");
    }
    order.sort(function (a, b) {
      var ia = TASK_ORDER.indexOf(a);
      var ib = TASK_ORDER.indexOf(b);
      return (
        (ia === -1 ? TASK_ORDER.length : ia) -
        (ib === -1 ? TASK_ORDER.length : ib)
      );
    });
    return order.map(function (t) {
      return { task: t, models: byTask[t] };
    });
  }

  store.promise = fetch(ZGPU_MODELS_URL)
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      var models = d && d.models && d.models.length ? d.models : null;
      // Sort by display priority (desc) here so every consumer gets the data
      // already ordered and doesn't need to re-sort.
      store.data = models
        ? models.slice().sort(function (a, b) {
            return (b.displayPriority || 0) - (a.displayPriority || 0);
          })
        : null;
      // Attach the hardcoded request/response examples to each model so the task
      // pages can render them without the API (which has no response samples).
      if (store.data) {
        store.data.forEach(function (m) {
          m.examples = (MODEL_EXTRAS[m.modelId] && MODEL_EXTRAS[m.modelId].examples) || [];
        });
      }
      // Prebuild the "library by task" grouping so pages don't have to.
      store.byTask = store.data ? buildByTask(store.data) : null;
      // Notify any component that mounted before the fetch resolved.
      window.dispatchEvent(new CustomEvent("zgpu:models-loaded"));
      return store.data;
    })
    .catch(function () {
      // Leave store.data null so consumers fall back to their seed snapshot,
      // and clear the promise so a later mount can retry.
      store.promise = null;
      return null;
    });
})();
