(function (root) {
  "use strict";

  const BUCKETS = ["9人以下", "10~20人", "21~50人", "51~100人", "101~200人"];
  const LOWER = [0, 10, 21, 51, 101];
  const UPPER = [9, 20, 50, 100, 200];

  function compressTargetScale(scaleValue) {
    const values = Array.isArray(scaleValue) ? scaleValue : (scaleValue ? [scaleValue] : []);
    const labels = [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))];
    const original = { display: labels.join("、"), compressed: false, labels };
    if (!labels.length || (labels.length === 1 && labels[0] === "不限規模")) return original;

    // Unknown values and mixed "unlimited" values keep their original meaning.
    if (labels.some(label => !BUCKETS.includes(label))) return original;
    const indices = labels.map(label => BUCKETS.indexOf(label)).sort((a, b) => a - b);
    if (indices.length === BUCKETS.length) {
      return { display: "不限規模", compressed: true, labels: ["不限規模"] };
    }
    if (indices.length === 1 || indices.some((index, offset) => index !== indices[0] + offset)) {
      return original;
    }
    const first = indices[0];
    const last = indices[indices.length - 1];
    const display = first === 0 ? `${UPPER[last]}人以下` : `${LOWER[first]}~${UPPER[last]}人`;
    return { display, compressed: true, labels: [display] };
  }

  root.compressTargetScale = compressTargetScale;
})(typeof window !== "undefined" ? window : globalThis);
