/**
 * Mintlify loads every .js file in the repo globally.
 * Per-model playgrounds: keep `model` visible but read-only (no edit, no delete).
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

  function lockModelFields() {
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

  function init() {
    injectStylesheet();
    lockModelFields();
    var observer = new MutationObserver(lockModelFields);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
