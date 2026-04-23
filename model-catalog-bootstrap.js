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
    var link = document.createElement("a");
    link.href = buildModelPagePath(model.modelId);
    link.style.display = "block";
    link.style.border = "1px solid var(--border, rgba(148, 163, 184, 0.25))";
    link.style.borderRadius = "16px";
    link.style.padding = "18px";
    link.style.textDecoration = "none";
    link.style.color = "var(--foreground, inherit)";
    link.style.background = "var(--background, #ffffff)";
    link.style.fontWeight = "400";
    link.style.transition = "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease";
    link.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.04)";

    var title = document.createElement("h3");
    title.style.margin = "0 0 8px 0";
    title.style.fontSize = "1.05rem";
    title.style.lineHeight = "1.35";
    title.style.fontWeight = "700";
    title.style.color = "var(--foreground, inherit)";
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
    params.style.color = "var(--muted, #9ca3af)";
    meta.appendChild(params);

    var dot = document.createElement("span");
    dot.textContent = "·";
    dot.style.color = "var(--muted, #6b7280)";
    meta.appendChild(dot);

    var badge = document.createElement("span");
    badge.textContent =
      typeof model.displayPriority === "number" && model.displayPriority >= 10
        ? "Recommended"
        : "Model";
    badge.style.display = "inline-block";
    badge.style.padding = "3px 10px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "0.82rem";
    badge.style.fontWeight = "600";
    if (badge.textContent === "Recommended") {
      badge.style.background = "rgba(34, 197, 94, 0.18)";
      badge.style.color = "rgb(74, 222, 128)";
    } else {
      badge.style.background = "rgba(245, 158, 11, 0.18)";
      badge.style.color = "rgb(251, 191, 36)";
    }
    meta.appendChild(badge);
    link.appendChild(meta);

    var description = document.createElement("p");
    description.style.margin = "0";
    description.style.lineHeight = "1.5";
    description.style.fontSize = "0.97rem";
    description.style.color = "var(--muted, #6b7280)";
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
      link.style.borderColor = "var(--primary, #22C55E)";
      link.style.transform = "translateY(-1px)";
      link.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.12)";
    });
    link.addEventListener("mouseleave", function () {
      link.style.borderColor = "var(--border, rgba(148, 163, 184, 0.25))";
      link.style.transform = "translateY(0)";
      link.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.06)";
    });

    return link;
  }

  function createDetailsForModelPage(model) {
    var wrapper = document.createElement("div");

    var subtitle = document.createElement("p");
    subtitle.innerHTML =
      "<strong>Task:</strong> " +
      textOrNA(model.taskDisplayName || model.taskType) +
      " · <strong>Provider:</strong> " +
      textOrNA(model.cloudProvider || "N/A");
    wrapper.appendChild(subtitle);

    var specs = document.createElement("p");
    specs.innerHTML =
      "<strong>Specs:</strong> " +
      "<code>Parameters: " +
      textOrNA(model.parameters) +
      "</code> · " +
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

    var pricing = model.pricing || {};
    var prices = document.createElement("p");
    prices.innerHTML =
      "<strong>Pricing:</strong> " +
      "<code>" +
      fmtMoney(pricing.input_per_1m_tokens) +
      " input</code> · " +
      "<code>" +
      fmtMoney(pricing.output_per_1m_tokens) +
      " output</code>";
    wrapper.appendChild(prices);

    var description = document.createElement("p");
    description.innerHTML =
      "<strong>Description:</strong> " + textOrNA(pricing.description);
    wrapper.appendChild(description);

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

      statusEl.textContent = "Loaded model details.";
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
