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

(function () {
  if (typeof window === "undefined") return;

  var ZGPU_MODELS_URL = "https://api-dashboard.zerogpu.ai/api/models";

  var store = window.__zgpuModels || (window.__zgpuModels = {});

  // Already fetched (or fetching) this page load -> nothing to do.
  if (store.data || store.promise) return;

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
