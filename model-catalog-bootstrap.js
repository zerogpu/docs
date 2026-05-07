/**
 * Mintlify loads every .js file in the content repo globally — not via <script> in MDX.
 * See: https://www.mintlify.com/docs/customize/custom-scripts
 */
(function () {
  const endpoint = "https://api-dashboard.zerogpu.ai/api/models";
  const fallbackEndpoint = "/snippets/model-catalog-fallback.json";

  function fmtMoney(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
    return "$" + value.toFixed(2) + " / 1M";
  }

  function textOrNA(value) {
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  }

  function createCell(row, text, code) {
    const cell = document.createElement("td");
    if (code) {
      const codeEl = document.createElement("code");
      codeEl.textContent = text;
      cell.appendChild(codeEl);
    } else {
      cell.textContent = text;
    }
    row.appendChild(cell);
  }

  function createDetails(model) {
    const wrapper = document.createElement("div");
    const heading = document.createElement("h3");
    heading.id = textOrNA(model.modelId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const idCode = document.createElement("code");
    idCode.textContent = textOrNA(model.modelId);
    heading.appendChild(idCode);
    wrapper.appendChild(heading);

    const task = document.createElement("p");
    task.innerHTML =
      "<strong>Task:</strong> " +
      textOrNA(model.taskDisplayName || model.taskType) +
      "  ";
    wrapper.appendChild(task);

    const provider = document.createElement("p");
    provider.innerHTML =
      "<strong>Provider:</strong> " + textOrNA(model.cloudProvider) + "  ";
    wrapper.appendChild(provider);

    const pricing = model.pricing || {};
    const pricingDescription = textOrNA(pricing.description);
    const useCases = Array.isArray(pricing.use_cases)
      ? pricing.use_cases.filter(Boolean)
      : [];

    const bestFor = document.createElement("p");
    bestFor.innerHTML = "<strong>Best for:</strong> " + pricingDescription;
    wrapper.appendChild(bestFor);

    const specs = document.createElement("p");
    specs.innerHTML =
      "<strong>Specs:</strong> " +
      "<code>Version: " +
      textOrNA(model.modelVersion) +
      "</code> · " +
      "<code>Max tokens: " +
      textOrNA(model.maxTokens) +
      "</code> · " +
      "<code>Type: " +
      textOrNA(model.modelType) +
      "</code>";
    wrapper.appendChild(specs);

    const prices = document.createElement("p");
    prices.innerHTML =
      "<strong>Pricing:</strong> " +
      "<code>" +
      fmtMoney(pricing.input_per_1m_tokens) +
      " input</code> · " +
      "<code>" +
      fmtMoney(pricing.output_per_1m_tokens) +
      " output</code> · " +
      "<code>" +
      fmtMoney(pricing.total_per_1m_tokens) +
      " total</code>";
    wrapper.appendChild(prices);

    if (useCases.length > 0) {
      const useCasesP = document.createElement("p");
      useCasesP.innerHTML =
        "<strong>Use cases:</strong> " + useCases.join(", ");
      wrapper.appendChild(useCasesP);
    }

    return wrapper;
  }

  function slugifyModelId(modelId) {
    return textOrNA(modelId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildModelPagePath(modelId) {
    return "/models/" + slugifyModelId(modelId);
  }

  function buildBadgeText(model) {
    if (model && model.parameters) return textOrNA(model.parameters);
    if (model && model.modelType) return textOrNA(model.modelType);
    return "Model";
  }

  function createModelCard(model) {
    function isDarkMode() {
      var root = document.documentElement;
      if (!root) return false;
      var themeAttr = (
        root.getAttribute("data-theme") ||
        root.getAttribute("data-color-theme") ||
        root.getAttribute("data-color-mode") ||
        ""
      ).toLowerCase();
      if (themeAttr.indexOf("dark") >= 0) return true;
      if (themeAttr.indexOf("light") >= 0) return false;
      if (root.classList.contains("dark")) return true;
      if (root.classList.contains("light")) return false;
      var body = document.body;
      if (body && body.classList.contains("dark")) return true;
      if (body && body.classList.contains("light")) return false;

      var computedScheme = (window.getComputedStyle(root).colorScheme || "").toLowerCase();
      if (computedScheme.indexOf("dark") >= 0) return true;
      if (computedScheme.indexOf("light") >= 0) return false;

      var scheme = (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches) || false;
      return scheme;
    }

    function getPalette() {
      if (isDarkMode()) {
        return {
          bg: "#000000",
          border: "rgba(71, 85, 105, 0.45)",
          shadow: "0 1px 2px rgba(0, 0, 0, 0.28)",
          hoverBorder: "var(--primary, #22C55E)",
          hoverShadow: "0 10px 24px rgba(0, 0, 0, 0.35)",
          title: "#f3f4f6",
          meta: "#a1a1aa",
          desc: "#a1a1aa",
        };
      }
      return {
        bg: "#ffffff",
        border: "rgba(203, 213, 225, 0.95)",
        shadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        hoverBorder: "var(--primary, #22C55E)",
        hoverShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
        title: "#1f2937",
        meta: "#6b7280",
        desc: "#4b5563",
      };
    }

    var palette = getPalette();
    var link = document.createElement("a");
    link.href = buildModelPagePath(model.modelId);
    link.style.display = "block";
    link.style.border = "1px solid " + palette.border;
    link.style.borderRadius = "16px";
    link.style.padding = "18px";
    link.style.textDecoration = "none";
    link.style.color = "var(--foreground, inherit)";
    link.style.background = palette.bg;
    link.style.fontWeight = "400";
    link.style.transition = "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease";
    link.style.boxShadow = palette.shadow;

    var title = document.createElement("h3");
    title.style.margin = "0 0 8px 0";
    title.style.fontSize = "1.05rem";
    title.style.lineHeight = "1.35";
    title.style.fontWeight = "700";
    title.style.color = palette.title;
    title.textContent = textOrNA(model.modelDisplayName || model.modelId);
    link.appendChild(title);

    var meta = document.createElement("div");
    meta.style.display = "flex";
    meta.style.alignItems = "center";
    meta.style.gap = "8px";
    meta.style.marginBottom = "12px";

    var params = document.createElement("span");
    params.textContent = buildBadgeText(model);
    params.style.fontSize = "0.95rem";
    params.style.color = palette.meta;
    meta.appendChild(params);

    var dot = document.createElement("span");
    dot.textContent = "·";
    dot.style.color = palette.meta;
    meta.appendChild(dot);

    var badge = document.createElement("span");
    badge.textContent = textOrNA(model.modelType).toLowerCase();
    badge.style.display = "inline-block";
    badge.style.padding = "3px 10px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "0.82rem";
    badge.style.fontWeight = "600";
    badge.style.background = "rgba(34, 197, 94, 0.18)";
    badge.style.color = "rgb(74, 222, 128)";
    meta.appendChild(badge);
    link.appendChild(meta);

    var description = document.createElement("p");
    description.style.margin = "0";
    description.style.lineHeight = "1.5";
    description.style.fontSize = "0.97rem";
    description.style.color = palette.desc;
    description.style.fontWeight = "400";
    description.style.display = "-webkit-box";
    description.style.webkitLineClamp = "2";
    description.style.webkitBoxOrient = "vertical";
    description.style.overflow = "hidden";
    var rawDescription = textOrNA((model.pricing || {}).description);
    description.textContent =
      rawDescription.length > 120
        ? rawDescription.slice(0, 117).trimEnd() + "..."
        : rawDescription;
    link.appendChild(description);

    link.addEventListener("mouseenter", function () {
      var hoverPalette = getPalette();
      link.style.borderColor = hoverPalette.hoverBorder;
      link.style.transform = "translateY(-1px)";
      link.style.boxShadow = hoverPalette.hoverShadow;
    });
    link.addEventListener("mouseleave", function () {
      var leavePalette = getPalette();
      link.style.borderColor = leavePalette.border;
      link.style.transform = "translateY(0)";
      link.style.boxShadow = leavePalette.shadow;
    });

    return link;
  }

  function createDetailsForModelPage(model) {
    var wrapper = document.createElement("div");
    var pricing = model.pricing || {};

    var overview = document.createElement("blockquote");
    overview.textContent = textOrNA(pricing.description);
    wrapper.appendChild(overview);

    var links = document.createElement("p");
    links.innerHTML =
      "<strong>References:</strong> " +
      (pricing.model_doc_url
        ? '<a href="' +
          pricing.model_doc_url +
          '" target="_blank" rel="noopener noreferrer">Model docs</a>'
        : "N/A") +
      " · " +
      (pricing.terms_url
        ? '<a href="' +
          pricing.terms_url +
          '" target="_blank" rel="noopener noreferrer">Terms</a>'
        : "N/A") +
      " · " +
      (pricing.privacy_service
        ? '<a href="' +
          pricing.privacy_service +
          '" target="_blank" rel="noopener noreferrer">Privacy</a>'
        : "N/A");
    wrapper.appendChild(links);

    var specsHeading = document.createElement("h2");
    specsHeading.textContent = "Specifications";
    wrapper.appendChild(specsHeading);

    var specsTable = document.createElement("table");
    specsTable.innerHTML =
      "<thead><tr><th>Property</th><th>Value</th></tr></thead>" +
      "<tbody>" +
      "<tr><td>Model ID</td><td><code>" + textOrNA(model.modelId) + "</code></td></tr>" +
      "<tr><td>Task</td><td>" + textOrNA(model.taskDisplayName || model.taskType) + "</td></tr>" +
      "<tr><td>Type</td><td><code>" + textOrNA(model.modelType) + "</code></td></tr>" +
      "<tr><td>Parameters</td><td>" + textOrNA(model.parameters) + "</td></tr>" +
      "<tr><td>Version</td><td>" + textOrNA(model.modelVersion) + "</td></tr>" +
      "<tr><td>Max Tokens</td><td>" + textOrNA(model.maxTokens) + "</td></tr>" +
      "<tr><td>Provider</td><td>" + textOrNA(model.cloudProvider || "N/A") + "</td></tr>" +
      "<tr><td>Input Price</td><td>" + fmtMoney(pricing.input_per_1m_tokens) + "</td></tr>" +
      "<tr><td>Output Price</td><td>" + fmtMoney(pricing.output_per_1m_tokens) + "</td></tr>" +
      "</tbody>";
    wrapper.appendChild(specsTable);

    var quickstartHeading = document.createElement("h2");
    quickstartHeading.textContent = "Quick Start";
    wrapper.appendChild(quickstartHeading);

    var quickstartIntro = document.createElement("p");
    quickstartIntro.textContent =
      "Use this model with the ZeroGPU Responses API endpoint:";
    wrapper.appendChild(quickstartIntro);

    var curlPre = document.createElement("pre");
    var curlCode = document.createElement("code");
    curlCode.textContent =
      "curl --location 'https://api.zerogpu.ai/v1/responses' \\\n" +
      "  --header 'content-type: application/json' \\\n" +
      "  --header 'x-api-key: YOUR_API_KEY' \\\n" +
      "  --header 'x-project-id: YOUR_PROJECT_ID' \\\n" +
      "  --data '{\n" +
      '    "model": "' + textOrNA(model.modelId) + '",\n' +
      '    "input": [\n' +
      "      {\n" +
      '        "role": "user",\n' +
      '        "content": "Your input text here..."\n' +
      "      }\n" +
      "    ],\n" +
      '    "text": { "format": { "type": "text" } }\n' +
      "  }'";
    curlPre.appendChild(curlCode);
    wrapper.appendChild(curlPre);

    return wrapper;
  }

  function fetchJson(url) {
    return fetch(url, { method: "GET" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.json();
    });
  }

  function parsePayload(payload) {
    if (
      !payload ||
      payload.success !== true ||
      !Array.isArray(payload.models)
    ) {
      throw new Error("Unexpected API response format");
    }
    return payload.models;
  }

  var modelsPromise = null;
  function getModels() {
    if (modelsPromise) return modelsPromise;
    modelsPromise = fetchJson(endpoint)
      .then(parsePayload)
      .catch(function () {
        return fetchJson(fallbackEndpoint).then(parsePayload);
      });
    return modelsPromise;
  }

  function prettyJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_err) {
      return String(value);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function simpleHighlight(code, lang) {
    var root = document.documentElement;
    var dark =
      (root && root.classList.contains("dark")) ||
      ((root && (root.getAttribute("data-theme") || "").toLowerCase().indexOf("dark") >= 0)) ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

    var palette = dark
      ? {
          key: "#7dd3fc",
          string: "#86efac",
          number: "#fbbf24",
          bool: "#fda4af",
          keyword: "#c4b5fd",
          comment: "#94a3b8",
          flag: "#fca5a5",
        }
      : {
          key: "#0369a1",
          string: "#166534",
          number: "#b45309",
          bool: "#be123c",
          keyword: "#6d28d9",
          comment: "#64748b",
          flag: "#b91c1c",
        };

    function wrap(token, color) {
      return '<span style="color:' + color + ';">' + token + "</span>";
    }

    // Protect strings first via placeholders so other regexes don't mangle them.
    var raw = escapeHtml(code);
    var strings = [];
    raw = raw.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, function (m) {
      var idx = strings.length;
      strings.push(m);
      return "__STR_" + idx + "__";
    });

    // Comments (line comments)
    if (lang === "javascript" || lang === "go" || lang === "rust") {
      raw = raw.replace(/\/\/.*/g, function (m) {
        return wrap(m, palette.comment);
      });
    } else if (lang === "python" || lang === "ruby" || lang === "bash") {
      raw = raw.replace(/#.*/g, function (m) {
        return wrap(m, palette.comment);
      });
    }

    // CLI flags
    if (lang === "bash") {
      raw = raw.replace(/(^|\s)(--?[a-zA-Z0-9-]+)/g, function (_m, p1, p2) {
        return p1 + wrap(p2, palette.flag);
      });
    }

    // Numbers
    raw = raw.replace(/\b\d+(\.\d+)?\b/g, function (m) {
      return wrap(m, palette.number);
    });

    // Booleans / null
    raw = raw.replace(/\b(true|false|null|True|False|None)\b/g, function (m) {
      return wrap(m, palette.bool);
    });

    // Keywords
    var keywordsByLang = {
      bash: /\b(curl|echo|export|if|then|fi)\b/g,
      python: /\b(import|from|as|def|class|return|if|else|for|while|in|try|except|with|lambda|yield)\b/g,
      javascript: /\b(const|let|var|function|return|if|else|for|while|try|catch|new|await|async)\b/g,
      rust: /\b(use|fn|let|mut|async|await|pub|impl|struct|enum|match|if|else|return|Result|Ok|Err)\b/g,
      go: /\b(package|import|func|var|const|if|else|for|range|return|type|struct)\b/g,
      ruby: /\b(require|def|end|if|else|elsif|do|class|module|begin|rescue|puts)\b/g,
    };
    var kwRegex = keywordsByLang[lang];
    if (kwRegex) {
      raw = raw.replace(kwRegex, function (m) {
        return wrap(m, palette.keyword);
      });
    }

    // Restore strings with JSON key detection.
    raw = raw.replace(/__STR_(\d+)__/g, function (_m, idxStr) {
      var idx = Number(idxStr);
      var str = strings[idx] || '""';
      return wrap(str, palette.string);
    });

    // JSON keys: highlighted differently from string values.
    if (lang === "json") {
      raw = raw.replace(
        /<span style="color:[^"]+;">(&quot;[^&]*&quot;|"(?:[^"\\]|\\.)*")<\/span>(\s*:)/g,
        function (_m, strToken, colon) {
          return wrap(strToken, palette.key) + colon;
        }
      );
    }

    return raw;
  }

  function setHighlightedCode(codeEl, lang, raw) {
    codeEl.innerHTML = simpleHighlight(raw, lang);
  }

  function shellEscapeSingleQuoted(value) {
    return String(value).replace(/'/g, "'\"'\"'");
  }

  function renderCurlSnippet(endpointPath, payload) {
    var payloadJson = prettyJson(payload);
    return (
      "curl --location 'https://api.zerogpu.ai" +
      endpointPath +
      "' \\\n" +
      "  --header 'content-type: application/json' \\\n" +
      "  --header 'x-api-key: YOUR_API_KEY' \\\n" +
      "  --header 'x-project-id: YOUR_PROJECT_ID' \\\n" +
      "  --data '" +
      shellEscapeSingleQuoted(payloadJson) +
      "'"
    );
  }

  function renderPythonSnippet(endpointPath, payload) {
    var payloadJson = prettyJson(payload);
    return (
      "import requests\nimport json\n\n" +
      'url = "https://api.zerogpu.ai' +
      endpointPath +
      '"\n' +
      "headers = {\n" +
      '    "content-type": "application/json",\n' +
      '    "x-api-key": "YOUR_API_KEY",\n' +
      '    "x-project-id": "YOUR_PROJECT_ID",\n' +
      "}\n" +
      'payload = json.loads("""' +
      payloadJson +
      '""")\n\n' +
      "response = requests.post(url, headers=headers, json=payload)\n" +
      "print(response.json())"
    );
  }

  function renderJavaScriptSnippet(endpointPath, payload) {
    return (
      "const url = 'https://api.zerogpu.ai" +
      endpointPath +
      "';\n" +
      "const headers = {\n" +
      "  'content-type': 'application/json',\n" +
      "  'x-api-key': 'YOUR_API_KEY',\n" +
      "  'x-project-id': 'YOUR_PROJECT_ID'\n" +
      "};\n" +
      "const payload = " +
      prettyJson(payload) +
      ";\n\n" +
      "fetch(url, {\n" +
      "  method: 'POST',\n" +
      "  headers,\n" +
      "  body: JSON.stringify(payload)\n" +
      "})\n" +
      "  .then(response => response.json())\n" +
      "  .then(data => console.log(data))\n" +
      "  .catch(error => console.error('Error:', error));"
    );
  }

  function renderRustSnippet(endpointPath, payload) {
    return (
      "use reqwest::Client;\nuse serde_json::Value;\n\n" +
      "#[tokio::main]\n" +
      "async fn main() -> Result<(), Box<dyn std::error::Error>> {\n" +
      "    let client = Client::new();\n\n" +
      '    let payload: Value = serde_json::from_str(r#"\n' +
      prettyJson(payload) +
      '\n"#)?;\n\n' +
      "    let response = client\n" +
      '        .post("https://api.zerogpu.ai' +
      endpointPath +
      '")\n' +
      '        .header("content-type", "application/json")\n' +
      '        .header("x-api-key", "YOUR_API_KEY")\n' +
      '        .header("x-project-id", "YOUR_PROJECT_ID")\n' +
      "        .json(&payload)\n" +
      "        .send()\n" +
      "        .await?;\n\n" +
      "    let body = response.text().await?;\n" +
      '    println!("{}", body);\n' +
      "    Ok(())\n" +
      "}"
    );
  }

  function renderGoSnippet(endpointPath, payload) {
    return (
      "package main\n\n" +
      "import (\n" +
      '  "bytes"\n  "fmt"\n  "io"\n  "net/http"\n)\n\n' +
      "func main() {\n" +
      '  url := "https://api.zerogpu.ai' +
      endpointPath +
      '"\n\n' +
      "  payloadBytes := []byte(`" +
      prettyJson(payload) +
      "`)\n\n" +
      '  req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))\n' +
      "  if err != nil {\n    panic(err)\n  }\n\n" +
      '  req.Header.Set("content-type", "application/json")\n' +
      '  req.Header.Set("x-api-key", "YOUR_API_KEY")\n' +
      '  req.Header.Set("x-project-id", "YOUR_PROJECT_ID")\n\n' +
      "  client := &http.Client{}\n" +
      "  res, err := client.Do(req)\n" +
      "  if err != nil {\n    panic(err)\n  }\n" +
      "  defer res.Body.Close()\n\n" +
      "  body, _ := io.ReadAll(res.Body)\n" +
      "  fmt.Println(string(body))\n" +
      "}"
    );
  }

  function renderRubySnippet(endpointPath, payload) {
    return (
      "require 'net/http'\nrequire 'uri'\n\n" +
      "uri = URI.parse('https://api.zerogpu.ai" +
      endpointPath +
      "')\n" +
      "http = Net::HTTP.new(uri.host, uri.port)\n" +
      "http.use_ssl = (uri.scheme == 'https')\n\n" +
      "request = Net::HTTP::Post.new(uri.request_uri)\n" +
      "request['content-type'] = 'application/json'\n" +
      "request['x-api-key'] = 'YOUR_API_KEY'\n" +
      "request['x-project-id'] = 'YOUR_PROJECT_ID'\n\n" +
      "request.body = <<~'JSON'\n" +
      prettyJson(payload) +
      "\nJSON\n\n" +
      "response = http.request(request)\n" +
      "puts response.body"
    );
  }

  function getPlaygroundPayload(model, format, selectedUsecaseKey) {
    var pricing = model.pricing || {};
    var usecases = model.modelUsecases || {};
    var selectedUsecase = selectedUsecaseKey ? usecases[selectedUsecaseKey] : null;
    if (format === "chat") {
      var chatPayload =
        (selectedUsecase && selectedUsecase.sample_chat_completions_body) ||
        pricing.sample_chat_completions_body ||
        {
          model: model.modelId,
          messages: [{ role: "user", content: "Your input text here..." }],
        };
      return { endpoint: "/v1/chat/completions", payload: { ...chatPayload, model: model.modelId } };
    }
    var responsePayload =
      (selectedUsecase && selectedUsecase.sample_responses_body) ||
      pricing.sample_responses_body ||
      {
        text: { format: { type: "text" } },
        input: [{ role: "user", content: "Your input text here..." }],
        model: model.modelId,
      };
    return { endpoint: "/v1/responses", payload: { ...responsePayload, model: model.modelId } };
  }

  function tryInitModelPlayground() {
    var containers = document.querySelectorAll("[data-zgpu-model-playground]");
    if (!containers || containers.length === 0) return;

    containers.forEach(function (container) {
      if (container.getAttribute("data-zgpu-playground-init") === "1") return;
      var modelId = container.getAttribute("data-zgpu-model-playground");
      if (!modelId) return;
      container.setAttribute("data-zgpu-playground-init", "1");
      container.innerHTML = "Loading examples...";

      getModels()
        .then(function (models) {
          var visibleModels = getVisibleModels(models);
          var model = visibleModels.find(function (item) {
            return String(item.modelId) === String(modelId);
          });
          if (!model) {
            container.textContent = "Model data not found.";
            return;
          }

          container.innerHTML = "";
          var wrap = document.createElement("div");
          wrap.style.display = "grid";
          wrap.style.gap = "14px";

          var controls = document.createElement("div");
          controls.style.display = "grid";
          controls.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
          controls.style.gap = "12px";

          var langWrap = document.createElement("label");
          langWrap.textContent = "Select Language";
          langWrap.style.display = "grid";
          langWrap.style.gap = "6px";
          var langSelect = document.createElement("select");
          ["cURL", "Python", "JavaScript", "Rust", "Go", "Ruby"].forEach(function (lang) {
            var opt = document.createElement("option");
            opt.value = lang.toLowerCase();
            opt.textContent = lang;
            langSelect.appendChild(opt);
          });
          langWrap.appendChild(langSelect);
          controls.appendChild(langWrap);

          var formatWrap = document.createElement("label");
          formatWrap.textContent = "OpenAI Format";
          formatWrap.style.display = "grid";
          formatWrap.style.gap = "6px";
          var formatSelect = document.createElement("select");
          [
            { value: "responses", label: "Responses" },
            { value: "chat", label: "Chat Completions" },
          ].forEach(function (fmt) {
            var opt = document.createElement("option");
            opt.value = fmt.value;
            opt.textContent = fmt.label;
            formatSelect.appendChild(opt);
          });
          formatWrap.appendChild(formatSelect);
          controls.appendChild(formatWrap);
          wrap.appendChild(controls);

          var usecases = model.modelUsecases && typeof model.modelUsecases === "object"
            ? Object.entries(model.modelUsecases).filter(function (entry) {
                return entry[1] && typeof entry[1] === "object";
              })
            : [];
          var usecaseRow = null;
          var usecaseDescription = null;
          var selectedUsecaseKey = usecases.length > 0 ? usecases[0][0] : null;
          if (usecases.length > 0) {
            var usecaseTitle = document.createElement("div");
            usecaseTitle.textContent = "Select Use Case";
            wrap.appendChild(usecaseTitle);
            usecaseRow = document.createElement("div");
            usecaseRow.style.display = "flex";
            usecaseRow.style.gap = "8px";
            usecaseRow.style.flexWrap = "wrap";
            usecases.forEach(function (entry, idx) {
              var key = entry[0];
              var value = entry[1];
              var btn = document.createElement("button");
              btn.type = "button";
              btn.textContent = textOrNA(value.usecase_display_name || key);
              btn.setAttribute("data-usecase-key", key);
              btn.style.borderRadius = "999px";
              btn.style.border = "1px solid var(--border, #374151)";
              btn.style.padding = "4px 10px";
              btn.style.background = idx === 0 ? "rgba(34,197,94,0.16)" : "transparent";
              btn.style.cursor = "pointer";
              btn.addEventListener("click", function () {
                selectedUsecaseKey = key;
                Array.prototype.forEach.call(
                  usecaseRow.querySelectorAll("button"),
                  function (node) {
                    node.style.background = "transparent";
                  }
                );
                btn.style.background = "rgba(34,197,94,0.16)";
                render();
              });
              usecaseRow.appendChild(btn);
            });
            wrap.appendChild(usecaseRow);
            usecaseDescription = document.createElement("div");
            usecaseDescription.style.color = "var(--muted, #6b7280)";
            usecaseDescription.style.fontSize = "0.95rem";
            wrap.appendChild(usecaseDescription);
          }

          var bodyTitle = document.createElement("h3");
          bodyTitle.textContent = "Request Body (JSON)";
          wrap.appendChild(bodyTitle);
          var bodyPre = document.createElement("pre");
          var bodyCode = document.createElement("code");
          bodyPre.appendChild(bodyCode);
          wrap.appendChild(bodyPre);

          var snippetHeader = document.createElement("div");
          snippetHeader.style.display = "flex";
          snippetHeader.style.justifyContent = "space-between";
          snippetHeader.style.alignItems = "center";
          var snippetTitle = document.createElement("h3");
          snippetTitle.textContent = "Code Snippet";
          snippetTitle.style.margin = "0";
          snippetHeader.appendChild(snippetTitle);
          var copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.textContent = "Copy";
          copyBtn.style.border = "1px solid var(--border, #374151)";
          copyBtn.style.padding = "4px 10px";
          copyBtn.style.borderRadius = "8px";
          copyBtn.style.cursor = "pointer";
          snippetHeader.appendChild(copyBtn);
          wrap.appendChild(snippetHeader);

          var snippetPre = document.createElement("pre");
          var snippetCode = document.createElement("code");
          snippetPre.appendChild(snippetCode);
          wrap.appendChild(snippetPre);

          var currentSnippet = "";
          function render() {
            var format = formatSelect.value;
            var lang = langSelect.value;
            var selectedUsecase =
              usecases.length > 0 && selectedUsecaseKey
                ? model.modelUsecases[selectedUsecaseKey]
                : null;
            if (usecaseDescription && selectedUsecase) {
              usecaseDescription.textContent = textOrNA(selectedUsecase.description);
            }
            var payloadInfo = getPlaygroundPayload(model, format, selectedUsecaseKey);
            setHighlightedCode(bodyCode, "json", prettyJson(payloadInfo.payload));

            var snippetLang = "bash";
            if (lang === "python") {
              currentSnippet = renderPythonSnippet(payloadInfo.endpoint, payloadInfo.payload);
              snippetLang = "python";
            } else if (lang === "javascript") {
              currentSnippet = renderJavaScriptSnippet(payloadInfo.endpoint, payloadInfo.payload);
              snippetLang = "javascript";
            } else if (lang === "rust") {
              currentSnippet = renderRustSnippet(payloadInfo.endpoint, payloadInfo.payload);
              snippetLang = "rust";
            } else if (lang === "go") {
              currentSnippet = renderGoSnippet(payloadInfo.endpoint, payloadInfo.payload);
              snippetLang = "go";
            } else if (lang === "ruby") {
              currentSnippet = renderRubySnippet(payloadInfo.endpoint, payloadInfo.payload);
              snippetLang = "ruby";
            } else {
              currentSnippet = renderCurlSnippet(payloadInfo.endpoint, payloadInfo.payload);
              snippetLang = "bash";
            }
            setHighlightedCode(snippetCode, snippetLang, currentSnippet);
          }

          langSelect.addEventListener("change", render);
          formatSelect.addEventListener("change", render);
          copyBtn.addEventListener("click", function () {
            if (!navigator.clipboard) return;
            navigator.clipboard.writeText(currentSnippet);
            copyBtn.textContent = "Copied";
            setTimeout(function () {
              copyBtn.textContent = "Copy";
            }, 1200);
          });

          render();
          container.appendChild(wrap);
        })
        .catch(function (error) {
          container.textContent =
            "Unable to load playground right now. " + (error && error.message ? error.message : String(error));
        });
    });
  }

  function normalizeTaskCategory(model) {
    var raw = textOrNA(model.taskDisplayName || model.taskType).toLowerCase();
    if (
      raw.indexOf("classification") >= 0 ||
      raw === "classification" ||
      raw === "text_classification"
    ) {
      return "Text Classification";
    }
    if (
      raw.indexOf("generation") >= 0 ||
      raw === "text_generation" ||
      raw === "generation"
    ) {
      return "Text Generation";
    }
    if (raw.indexOf("pii") >= 0 || raw.indexOf("personally identifiable") >= 0) {
      return "PII";
    }
    if (raw.indexOf("summary") >= 0 || raw.indexOf("summarization") >= 0) {
      return "Summarization";
    }
    return null;
  }

  function isAdTechModel(model) {
    if (!model) return false;
    var modelId = textOrNA(model.modelId).toLowerCase();
    var modelType = textOrNA(model.modelType).toLowerCase();
    if (modelId.indexOf("iab") >= 0 || modelType.indexOf("iab") >= 0) return true;

    var useCases = Array.isArray(model.pricing && model.pricing.use_cases)
      ? model.pricing.use_cases
      : [];
    return useCases.some(function (uc) {
      return textOrNA(uc).toLowerCase().indexOf("ad tech") >= 0;
    });
  }

  function renderLibraryByTask(models, targetEl) {
    targetEl.innerHTML = "";
    var sectionOrder = [
      "Text Classification",
      "Text Generation",
      "PII",
      "Summarization",
    ];
    var groups = {};
    sectionOrder.forEach(function (name) {
      groups[name] = [];
    });

    models.forEach(function (model) {
      var category = normalizeTaskCategory(model);
      if (category && groups[category]) {
        groups[category].push(model);
      }
    });

    sectionOrder.forEach(function (category) {
      var section = document.createElement("section");
      var heading = document.createElement("h3");
      heading.textContent = category;
      section.appendChild(heading);

      if (groups[category].length === 0) {
        var empty = document.createElement("p");
        empty.textContent = "No models available in this category right now.";
        section.appendChild(empty);
      } else {
        groups[category]
          .slice()
          .sort(function (a, b) {
            return String(a.modelId).localeCompare(String(b.modelId));
          })
          .forEach(function (model) {
            section.appendChild(createDetails(model));
          });
      }

      targetEl.appendChild(section);
    });
  }

  function getVisibleModels(models) {
    if (!Array.isArray(models)) return [];
    return models
      .filter(function (model) {
        return model && model.display !== false;
      })
      .sort(function (a, b) {
        var aPriority =
          typeof a.displayPriority === "number" ? a.displayPriority : -Infinity;
        var bPriority =
          typeof b.displayPriority === "number" ? b.displayPriority : -Infinity;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return String(a.modelId).localeCompare(String(b.modelId));
      });
  }

  function tryInitModelCategoryPage() {
    var statusEl = document.getElementById("model-category-status");
    var cardsEl = document.getElementById("model-category-grid");
    if (!statusEl || !cardsEl) return;
    if (statusEl.getAttribute("data-zerogpu-category-init") === "1") return;

    var category =
      statusEl.getAttribute("data-model-category") ||
      cardsEl.getAttribute("data-model-category");
    if (!category) {
      statusEl.textContent = "Missing model category configuration.";
      return;
    }

    statusEl.setAttribute("data-zerogpu-category-init", "1");

    function renderCategory(models) {
      cardsEl.innerHTML = "";
      cardsEl.style.display = "grid";
      cardsEl.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
      cardsEl.style.gap = "16px";

      var visibleModels = getVisibleModels(models);
      var categoryModels = visibleModels.filter(function (model) {
        if (category === "Ad-Tech") {
          return isAdTechModel(model);
        }
        return normalizeTaskCategory(model) === category;
      });

      if (categoryModels.length === 0) {
        statusEl.style.display = "";
        statusEl.textContent = "No models available in this category right now.";
        return;
      }

      statusEl.textContent = "";
      statusEl.style.display = "none";

      categoryModels.forEach(function (model) {
        cardsEl.appendChild(createModelCard(model));
      });
    }

    fetchJson(endpoint)
      .then(function (payload) {
        renderCategory(parsePayload(payload));
      })
      .catch(function () {
        return fetchJson(fallbackEndpoint)
          .then(function (payload) {
            renderCategory(parsePayload(payload));
            statusEl.textContent =
              statusEl.textContent + " (using local fallback snapshot)";
          })
          .catch(function (fallbackError) {
            statusEl.style.display = "";
            statusEl.textContent =
              "Unable to load models right now. " + fallbackError.message;
          });
      });
  }

  function tryInitModelDetailPage() {
    var statusEl = document.getElementById("model-detail-status");
    var contentEl = document.getElementById("model-detail-content");
    if (!statusEl || !contentEl) return;
    if (statusEl.getAttribute("data-zerogpu-model-init") === "1") return;

    var modelId = statusEl.getAttribute("data-model-id");
    if (!modelId) {
      statusEl.textContent = "Missing model ID.";
      return;
    }

    statusEl.setAttribute("data-zerogpu-model-init", "1");

    function renderModel(models) {
      contentEl.innerHTML = "";
      var visibleModels = getVisibleModels(models);
      var selected = visibleModels.find(function (model) {
        return String(model.modelId) === String(modelId);
      });

      if (!selected) {
        statusEl.textContent = "Model not found.";
        return;
      }

      statusEl.textContent = "";
      statusEl.style.display = "none";
      contentEl.appendChild(createDetailsForModelPage(selected));
    }

    fetchJson(endpoint)
      .then(function (payload) {
        renderModel(parsePayload(payload));
      })
      .catch(function () {
        return fetchJson(fallbackEndpoint)
          .then(function (payload) {
            renderModel(parsePayload(payload));
            statusEl.textContent =
              statusEl.textContent + " (using local fallback snapshot)";
          })
          .catch(function (fallbackError) {
            statusEl.style.display = "";
            statusEl.textContent =
              "Unable to load model details right now. " + fallbackError.message;
          });
      });
  }

  function tryInitModelCatalog() {
    var statusEl = document.getElementById("model-catalog-status");
    if (!statusEl || statusEl.getAttribute("data-zerogpu-catalog-init") === "1") {
      return;
    }
    var tableEl = document.getElementById("model-catalog-table");
    var cardsEl = document.getElementById("model-catalog-cards");
    var libraryEl = document.getElementById("model-catalog-library");
    if (!tableEl || !cardsEl || !libraryEl) return;

    statusEl.setAttribute("data-zerogpu-catalog-init", "1");

    function renderCatalog(models) {
      tableEl.innerHTML = "";
      cardsEl.innerHTML = "";
      libraryEl.innerHTML = "";

      if (!Array.isArray(models) || models.length === 0) {
        statusEl.textContent = "No models available right now.";
        return;
      }

      var visibleModels = getVisibleModels(models);

      if (visibleModels.length === 0) {
        statusEl.textContent = "No models available right now.";
        return;
      }

      statusEl.textContent =
        "Loaded " +
        visibleModels.length +
        " model" +
        (visibleModels.length === 1 ? "" : "s") +
        ".";

      var table = document.createElement("table");
      table.innerHTML =
        "<thead>" +
        "<tr>" +
        "<th>Model ID</th>" +
        "<th>Task</th>" +
        "<th>Version</th>" +
        "<th>Max Tokens</th>" +
        "<th>Type</th>" +
        "<th>Input</th>" +
        "<th>Output</th>" +
        "</tr>" +
        "</thead>";

      var tbody = document.createElement("tbody");
      visibleModels.forEach(function (model) {
        var row = document.createElement("tr");
        createCell(row, textOrNA(model.modelId), true);
        createCell(row, textOrNA(model.taskDisplayName || model.taskType));
        createCell(row, textOrNA(model.modelVersion));
        createCell(row, textOrNA(model.maxTokens));
        createCell(row, textOrNA(model.modelType));

        var p = model.pricing || {};
        createCell(row, fmtMoney(p.input_per_1m_tokens));
        createCell(row, fmtMoney(p.output_per_1m_tokens));
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      tableEl.appendChild(table);

      visibleModels.forEach(function (model) {
        cardsEl.appendChild(createDetails(model));
      });

      renderLibraryByTask(visibleModels, libraryEl);
    }

    fetchJson(endpoint)
      .then(function (payload) {
        renderCatalog(parsePayload(payload));
      })
      .catch(function () {
        return fetchJson(fallbackEndpoint)
          .then(function (payload) {
            renderCatalog(parsePayload(payload));
            statusEl.textContent =
              statusEl.textContent + " (using local fallback snapshot)";
          })
          .catch(function (fallbackError) {
            statusEl.textContent =
              "Unable to load models right now. " + fallbackError.message;
          });
      });
  }

  function schedule() {
    tryInitModelCatalog();
    tryInitModelCategoryPage();
    tryInitModelDetailPage();
    tryInitModelPlayground();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  var observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
