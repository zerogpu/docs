/**
 * Mintlify loads every .js file in the content repo globally.
 * Keeps API playground request bodies in sync when the model field changes.
 */
(function () {
  var PAYLOADS_URL = "/openapi/zerogpu-playground-payloads.json";
  var payloads = null;
  var applying = false;
  var lastAppliedModel = null;

  function endpointKind() {
    var path = location.pathname || "";
    if (path.indexOf("chat-completions") >= 0) return "chat";
    if (path.indexOf("/responses") >= 0) return "responses";
    return null;
  }

  function loadPayloads() {
    if (payloads) return Promise.resolve(payloads);
    return fetch(PAYLOADS_URL, { method: "GET" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load playground payloads");
        }
        return response.json();
      })
      .then(function (data) {
        payloads = data;
        return data;
      });
  }

  function knownModelIds() {
    var kind = endpointKind();
    if (!payloads || !kind || !payloads[kind]) return [];
    return Object.keys(payloads[kind]);
  }

  function getPayload(modelId) {
    var kind = endpointKind();
    if (!kind || !payloads || !payloads[kind]) return null;
    return payloads[kind][modelId] || null;
  }

  function isKnownModelId(value) {
    if (!value) return false;
    return knownModelIds().indexOf(value) >= 0;
  }

  function findJsonEditors() {
    var editors = [];
    document.querySelectorAll("textarea").forEach(function (el) {
      var value = el.value || "";
      if (
        value.indexOf('"model"') >= 0 &&
        (value.indexOf('"input"') >= 0 ||
          value.indexOf('"messages"') >= 0 ||
          value.indexOf('"metadata"') >= 0)
      ) {
        editors.push(el);
      }
    });
    return editors;
  }

  function readEditorState() {
    var editors = findJsonEditors();
    for (var i = 0; i < editors.length; i++) {
      try {
        var parsed = JSON.parse(editors[i].value);
        if (parsed && typeof parsed === "object" && parsed.model) {
          return { editor: editors[i], parsed: parsed };
        }
      } catch (e) {}
    }
    return null;
  }

  function writePayload(modelId) {
    var body = getPayload(modelId);
    if (!body) return;

    applying = true;
    lastAppliedModel = modelId;
    var text = JSON.stringify(body, null, 2);
    var editors = findJsonEditors();

    editors.forEach(function (el) {
      if (el.value === text) return;
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    window.setTimeout(function () {
      applying = false;
    }, 150);
  }

  function applyModel(modelId) {
    if (!modelId || !isKnownModelId(modelId)) return;
    if (applying || modelId === lastAppliedModel) return;
    writePayload(modelId);
  }

  function attachSelectListeners() {
    knownModelIds().forEach(function (modelId) {
      document.querySelectorAll("select").forEach(function (select) {
        var options = Array.prototype.map.call(
          select.options || [],
          function (opt) {
            return opt.value;
          }
        );
        if (options.indexOf(modelId) < 0) return;
        if (select.getAttribute("data-zgpu-model-sync") === "1") return;
        select.setAttribute("data-zgpu-model-sync", "1");
        select.addEventListener("change", function () {
          applyModel(select.value);
        });
      });
    });
  }

  function watchEditorModelField() {
    if (applying) return;
    var state = readEditorState();
    if (!state || !isKnownModelId(state.parsed.model)) return;
    if (state.parsed.model === lastAppliedModel) return;
    applyModel(state.parsed.model);
  }

  function init() {
    if (!endpointKind()) return;

    loadPayloads()
      .then(function () {
        attachSelectListeners();

        window.setInterval(watchEditorModelField, 600);

        var observer = new MutationObserver(function () {
          attachSelectListeners();
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      })
      .catch(function () {
        /* Playground still works without sync */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
