/**
 * Mintlify loads every .js file in the repo globally.
 * Playground tweaks:
 * - Per-model playgrounds: keep `model` visible but read-only (no edit, no delete).
 * - Responses playgrounds: render the `input` string field as a multiline textarea.
 */
(function () {
  var STYLE_ID = "zgpu-playground-model-lock-css";
  var STYLE_HREF = "/style.css";

  function injectStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    document.head.appendChild(link);
  }

  function isModelLabel(el) {
    if (!el || el.children.length > 0) return false;
    return (el.textContent || "").trim() === "model";
  }

  function isInputLabel(el) {
    if (!el || el.children.length > 0) return false;
    return (el.textContent || "").trim() === "input";
  }

  function findModelFieldRoot(start) {
    var node = start.parentElement;
    for (var depth = 0; depth < 14 && node; depth += 1, node = node.parentElement) {
      var control = node.querySelector(
        'input, select, textarea, [contenteditable="true"]'
      );
      if (!control) continue;
      if (!node.querySelector('label, span, p, h4, h5, div')) continue;
      var labels = node.querySelectorAll("label, span, p, h4, h5");
      for (var i = 0; i < labels.length; i += 1) {
        if (isModelLabel(labels[i])) return { root: node, control: control };
      }
    }
    return null;
  }

  function findInputFieldRoot(start) {
    var node = start.parentElement;
    for (var depth = 0; depth < 14 && node; depth += 1, node = node.parentElement) {
      var control = node.querySelector('input, textarea');
      if (!control) continue;
      var labels = node.querySelectorAll("label, span, p, h4, h5");
      for (var i = 0; i < labels.length; i += 1) {
        if (isInputLabel(labels[i])) return { root: node, control: control };
      }
    }
    return null;
  }

  function isDeleteButton(btn) {
    if (!btn || btn.tagName !== "BUTTON") return false;
    var label = (
      btn.getAttribute("aria-label") ||
      btn.getAttribute("title") ||
      btn.textContent ||
      ""
    ).toLowerCase();
    if (/delete|remove|clear/.test(label)) return true;
    return !!btn.querySelector(
      'svg path[d*="M432"], svg path[d*="trash"], svg path[d*="M135"]'
    );
  }

  function lockControl(control) {
    if (control.tagName === "SELECT") {
      control.disabled = true;
    } else if (control.isContentEditable) {
      control.setAttribute("contenteditable", "false");
    } else {
      control.readOnly = true;
      control.setAttribute("aria-readonly", "true");
    }
    control.setAttribute("data-zgpu-model-locked", "1");
    control.tabIndex = -1;
  }

  function isPerModelPlaygroundPage() {
    var path = window.location.pathname || "";
    return (
      /\/api-reference\/models\//.test(path) || /^\/models\//.test(path)
    );
  }

  function lockModelFields() {
    if (!isPerModelPlaygroundPage()) return;
    var labels = document.querySelectorAll("label, span, p, h4, h5");
    for (var i = 0; i < labels.length; i += 1) {
      if (!isModelLabel(labels[i])) continue;
      var found = findModelFieldRoot(labels[i]);
      if (!found) continue;

      found.root.classList.add("zgpu-model-field-locked");
      lockControl(found.control);

      var buttons = found.root.querySelectorAll("button");
      for (var b = 0; b < buttons.length; b += 1) {
        if (isDeleteButton(buttons[b])) {
          buttons[b].style.display = "none";
          buttons[b].setAttribute("data-zgpu-model-delete-hidden", "1");
        }
      }
    }
  }

  function setNativeValue(input, value) {
    var proto = Object.getPrototypeOf(input);
    var descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function enhanceInputTextareas() {
    var labels = document.querySelectorAll("label, span, p, h4, h5");
    for (var i = 0; i < labels.length; i += 1) {
      if (!isInputLabel(labels[i])) continue;
      var found = findInputFieldRoot(labels[i]);
      if (!found || found.root.getAttribute("data-zgpu-input-textarea") === "1") continue;
      if (found.control.tagName === "TEXTAREA") {
        found.control.classList.add("zgpu-input-textarea");
        found.root.setAttribute("data-zgpu-input-textarea", "1");
        continue;
      }
      if (found.control.tagName !== "INPUT") continue;

      found.root.setAttribute("data-zgpu-input-textarea", "1");
      found.root.classList.add("zgpu-input-field-root");
      found.control.classList.add("zgpu-input-textarea-source");

      var textarea = document.createElement("textarea");
      textarea.className = "zgpu-input-textarea";
      textarea.value = found.control.value || "";
      textarea.placeholder =
        found.control.getAttribute("placeholder") || "Enter input";
      textarea.setAttribute("aria-label", "input");
      textarea.setAttribute("data-zgpu-input-textarea-mirror", "1");

      textarea.addEventListener("input", function (event) {
        var source = event.currentTarget.previousElementSibling;
        if (source && source.tagName === "INPUT") {
          setNativeValue(source, event.currentTarget.value);
        }
      });

      found.control.parentElement.insertBefore(textarea, found.control.nextSibling);
    }
  }

  function syncInputTextareas() {
    var mirrors = document.querySelectorAll("[data-zgpu-input-textarea-mirror='1']");
    for (var i = 0; i < mirrors.length; i += 1) {
      if (document.activeElement === mirrors[i]) continue;
      var source = mirrors[i].previousElementSibling;
      if (source && source.tagName === "INPUT" && mirrors[i].value !== source.value) {
        mirrors[i].value = source.value || "";
      }
    }
  }

  function init() {
    injectStylesheet();
    lockModelFields();
    enhanceInputTextareas();
    var observer = new MutationObserver(function () {
      lockModelFields();
      enhanceInputTextareas();
      syncInputTextareas();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setInterval(syncInputTextareas, 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
