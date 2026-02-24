const MIN_CHART_WIDTH = 320;
const tooltip = d3.select("#tooltip");

export function createChart({ containerId, margin, height }) {
  const container = d3.select(containerId);
  container.selectAll("*").remove();

  const width = Math.max(container.node().clientWidth, MIN_CHART_WIDTH);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { container, svg, g, width, height, innerWidth, innerHeight };
}

export function showTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY - 28}px`)
    .html(html);
}

export function hideTooltip() {
  tooltip.style("opacity", 0);
}

export function formatNumber(value) {
  return d3.format(".2f")(value);
}

export function formatMaybe(value) {
  return Number.isFinite(value) ? `${formatNumber(value)}%` : "N/A";
}

export function formatMoney(value) {
  return Number.isFinite(value) ? `$${d3.format(",.0f")(value)}` : "N/A";
}

export function getRowKey(row) {
  if (typeof row.Code === "string" && row.Code.length === 3) {
    return row.Code.toUpperCase();
  }
  return row.Entity;
}

export function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFeatureName(feature) {
  const props = feature.properties || {};
  return props.name || props.NAME || props.admin || props.ADMIN || "Unknown";
}

export function getFeatureIso3(feature) {
  const props = feature.properties || {};
  const candidates = [
    feature.id,
    props.iso_a3,
    props.ISO_A3,
    props.adm0_a3,
    props.ADM0_A3,
    props.code,
    props.Code,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.length === 3) {
      return value.toUpperCase();
    }
  }
  return null;
}
