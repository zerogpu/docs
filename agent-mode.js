/*
 * Site-wide Human | Agent switch. Mintlify loads every root .js file on every page, and the
 * docs are a single-page app, so this watches the DOM: it keeps the switch on the navbar's
 * right side, beside the icon links, and, in Agent mode, replaces
 * the page body with a plain-text view: key URLs, a hand-off prompt, and the page's Markdown
 * (Mintlify serves it at <path>.md). It also advertises that Markdown with <link rel=alternate>,
 * mirrors the mode into ?view=agent, and relabels the navbar button as Edge Portal inside Edge Providers.
 * Cookbook recipes add their own goal/stack/verify through <AgentRecipe> (snippets/agent-recipe.jsx).
 */
(function () {
  if (window.__zgAgentMode) return;
  window.__zgAgentMode = true;

  var STORAGE_KEY = "zg-audience";
  var PUBLIC_DOCS = "https://docs.zerogpu.ai";
  var mode = "human";
  var markdownCache = {};

  function readStoredMode() {
    var fromUrl = new URLSearchParams(window.location.search).get("view");
    if (fromUrl === "agent" || fromUrl === "human") return fromUrl;
    try {
      return localStorage.getItem(STORAGE_KEY) === "agent" ? "agent" : "human";
    } catch (e) {
      return "human";
    }
  }

  function setMode(next) {
    mode = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    apply();
  }

  function pagePath() {
    var path = window.location.pathname.replace(/\/+$/, "");
    return path === "" ? "/index" : path;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key === "onclick") node.addEventListener("click", attrs[key]);
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function buildSwitch() {
    var wrap = el("div", { id: "zg-audience-switch", role: "tablist" });
    ["human", "agent"].forEach(function (value) {
      wrap.appendChild(
        el("button", {
          type: "button",
          role: "tab",
          "data-value": value,
          text: value === "human" ? "Human" : "Agent",
          onclick: function () {
            setMode(value);
          },
        })
      );
    });
    return wrap;
  }

  function placeSwitch() {
    var existing = document.getElementById("zg-audience-switch");
    var navLink = document.querySelector("li.navbar-link");
    var host = navLink ? navLink.parentElement : null;
    if (!host) return;
    if (!existing || existing.parentElement !== host) {
      if (existing) existing.remove();
      existing = buildSwitch();
      host.insertBefore(existing, host.firstChild);
    }
    existing.querySelectorAll("button").forEach(function (button) {
      var active = button.getAttribute("data-value") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function recipePrompt(recipe, mdUrl) {
    return [
      "Build this with ZeroGPU: " + recipe.getAttribute("data-goal"),
      "",
      "Follow this ZeroGPU cookbook recipe:",
      mdUrl,
      "",
      "Context:",
      "- ZeroGPU is an OpenAI-compatible inference API. Base URL: https://api.zerogpu.ai/v1",
      "- Read my API key from the ZEROGPU_API_KEY environment variable. Never hard-code or print it.",
      "- Models, endpoints and parameters: " + PUBLIC_DOCS + "/llms.txt (full docs: " + PUBLIC_DOCS + "/llms-full.txt)",
      "- Stack: " + recipe.getAttribute("data-stack"),
      "",
      "Steps:",
      "1. Read the whole recipe before you start.",
      "2. Install and configure exactly what the recipe uses.",
      "3. Build it step by step with the recipe's model IDs and request shapes.",
      "4. " + recipe.getAttribute("data-verify"),
      "5. Tell me what you built and how to run it again.",
    ].join("\n");
  }

  function pagePrompt(title, mdUrl, isEdge) {
    return [
      "Use this ZeroGPU docs page for my task: " + title,
      mdUrl,
      "",
      "Context:",
      isEdge
        ? "- ZeroGPU Edge connects devices to the ZeroGPU network to serve inference and earn. My Edge SDK key (zgpu-sdk-…) is in the ZEROGPU_SDK_KEY environment variable. Never hard-code or print it."
        : "- ZeroGPU is an OpenAI-compatible inference API. Base URL: https://api.zerogpu.ai/v1. Read my API key from the ZEROGPU_API_KEY environment variable. Never hard-code or print it.",
      "- Docs index: " + PUBLIC_DOCS + "/llms.txt (full docs: " + PUBLIC_DOCS + "/llms-full.txt)",
      "",
      "Read the page first, then do what I ask using only what the docs describe.",
    ].join("\n");
  }

  function copyButton(label, getText) {
    var button = el("button", { type: "button", class: "zg-agent-btn", text: label });
    button.addEventListener("click", function () {
      var text = getText();
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(
        function () {
          button.textContent = "Copied";
          setTimeout(function () {
            button.textContent = label;
          }, 2000);
        },
        function () {}
      );
    });
    return button;
  }

  function link(text, href) {
    return el("a", { href: href, target: "_blank", rel: "noreferrer", text: text });
  }

  function buildAgentView(path) {
    var mdPath = path + ".md";
    var mdUrl = PUBLIC_DOCS + mdPath;
    var isEdge = path.indexOf("/edge") === 0;
    var titleNode = document.getElementById("page-title");
    var title = titleNode ? titleNode.textContent.trim() : document.title;
    var recipe = document.querySelector(".zg-recipe");
    var prompt = recipe ? recipePrompt(recipe, mdUrl) : pagePrompt(title, mdUrl, isEdge);
    var encoded = encodeURIComponent(prompt);

    var facts = [
      ["page", mdUrl],
      ["index", PUBLIC_DOCS + "/llms.txt"],
      ["full docs", PUBLIC_DOCS + "/llms-full.txt"],
    ].concat(
      isEdge
        ? [
            ["portal", "https://edge.zerogpu.ai"],
            ["agent", "https://apps.zerogpu.ai/edge"],
            ["key", "SDK key zgpu-sdk-… (env ZEROGPU_SDK_KEY)"],
          ]
        : [
            ["api base", "https://api.zerogpu.ai/v1"],
            ["auth", "x-api-key: $ZEROGPU_API_KEY  or  Authorization: Bearer $ZEROGPU_API_KEY"],
          ]
    );
    var factsText = facts
      .map(function (row) {
        return (row[0] + ":").padEnd(11) + row[1];
      })
      .join("\n");

    var markdownPre = el("pre", { class: "zg-agent-markdown", text: "GET " + mdPath + " …" });

    var view = el("div", { id: "zg-agent-view", class: "not-prose", "data-path": path }, [
      el("div", { class: "zg-agent-bar" }, [
        el("span", { class: "zg-agent-badge", text: "AGENT VIEW" }),
        el("code", { class: "zg-agent-source", text: mdPath }),
        el("div", { class: "zg-agent-actions" }, [
          copyButton("Copy Markdown", function () {
            return markdownCache[mdPath];
          }),
          copyButton("Copy prompt", function () {
            return prompt;
          }),
          link("llms.txt", PUBLIC_DOCS + "/llms.txt"),
          link("llms-full.txt", PUBLIC_DOCS + "/llms-full.txt"),
          link("Open in Claude", "https://claude.ai/new?q=" + encoded),
          link("Open in ChatGPT", "https://chatgpt.com/?q=" + encoded),
        ]),
      ]),
      el("pre", { class: "zg-agent-facts", text: factsText }),
      el("details", { class: "zg-agent-prompt" }, [
        el("summary", { text: recipe ? "Hand-off prompt for this recipe" : "Hand-off prompt for this page" }),
        el("pre", { text: prompt }),
      ]),
      markdownPre,
    ]);

    if (markdownCache[mdPath]) {
      markdownPre.textContent = markdownCache[mdPath];
    } else {
      fetch(mdPath)
        .then(function (res) {
          if (!res.ok) throw new Error(String(res.status));
          return res.text();
        })
        .then(function (text) {
          markdownCache[mdPath] = text;
          markdownPre.textContent = text;
        })
        .catch(function () {
          markdownPre.textContent = "This page has no Markdown version. Use " + PUBLIC_DOCS + "/llms-full.txt instead.";
        });
    }
    return view;
  }

  function advertiseMarkdown() {
    var href = pagePath() + ".md";
    var tag = document.getElementById("zg-markdown-alternate");
    if (!tag) {
      tag = el("link", { id: "zg-markdown-alternate", rel: "alternate", type: "text/markdown" });
      document.head.appendChild(tag);
    }
    if (tag.getAttribute("href") !== href) tag.setAttribute("href", href);
  }

  function placeAgentView() {
    var area = document.getElementById("content-area");
    var existing = document.getElementById("zg-agent-view");
    var path = pagePath();
    if (mode !== "agent" || !area) {
      if (existing) existing.remove();
      return;
    }
    var titleNode = document.getElementById("page-title");
    var key = path + "|" + (titleNode ? titleNode.textContent : "") + "|" + !!document.querySelector(".zg-recipe");
    if (existing && existing.parentElement === area && existing.getAttribute("data-key") === key) return;
    if (existing) existing.remove();
    var header = document.getElementById("header");
    var view = buildAgentView(path);
    if (header && header.parentElement === area) header.insertAdjacentElement("afterend", view);
    else area.insertBefore(view, area.firstChild);
    view.setAttribute("data-key", key);
  }

  function syncUrl() {
    var url = new URL(window.location.href);
    var current = url.searchParams.get("view");
    if (mode === "agent" && current === "agent") return;
    if (mode === "human" && current === null) return;
    if (mode === "agent") url.searchParams.set("view", "agent");
    else url.searchParams.delete("view");
    // Keep the router's history.state so back/forward still work in the single-page app.
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  var EDGE_PORTAL = { label: "Edge Portal", href: "https://edge.zerogpu.ai" };

  // The navbar's primary button is global in docs.json; inside Edge Providers it points at the Edge portal instead.
  function relabelPrimaryButton() {
    var onEdge = pagePath().indexOf("/edge") === 0;
    document.querySelectorAll("#navbar a[data-zg-primary], #navbar a[href='https://platform.zerogpu.ai/']").forEach(function (a) {
      if (!a.hasAttribute("data-zg-primary")) a.setAttribute("data-zg-primary", a.getAttribute("href"));
      var href = onEdge ? EDGE_PORTAL.href : a.getAttribute("data-zg-primary");
      if (a.getAttribute("href") !== href) a.setAttribute("href", href);
      var walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var text = node.nodeValue.trim();
        if (text === "Platform" && onEdge) node.nodeValue = node.nodeValue.replace("Platform", EDGE_PORTAL.label);
        else if (text === EDGE_PORTAL.label && !onEdge) node.nodeValue = node.nodeValue.replace(EDGE_PORTAL.label, "Platform");
      }
    });
  }

  function apply() {
    var root = document.documentElement;
    if (mode === "agent") root.setAttribute("data-zg-audience", "agent");
    else root.removeAttribute("data-zg-audience");
    syncUrl();
    placeSwitch();
    placeAgentView();
    advertiseMarkdown();
    relabelPrimaryButton();
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  function start() {
    mode = readStoredMode();
    apply();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
