import {
  createChart,
  formatMaybe,
  formatMoney,
  formatNumber,
  getFeatureIso3,
  getFeatureName,
  getRowKey,
  hideTooltip,
  normalizeName,
  showTooltip,
} from "./chart-utils.js";

let mapCountries;
let mapColorScale;
let mapMetricKey = "inbound_pct";
let mapBaseRows = [];
let mapVisibleKeySet = null;
let mapCurrentYear = null;

function isMobilityMetric(metricKey) {
  return metricKey === "inbound_pct" || metricKey === "outbound_pct";
}

function drawLegend(minValue, maxValue, scaleMin, scaleMax, metricKey) {
  const container = d3.select("#map-legend");
  container.selectAll("*").remove();

  const containerWidth = container.node()?.clientWidth || 320;
  const width = Math.max(320, Math.min(containerWidth, 440));
  const height = 108;
  const barWidth = width - 80;
  const barHeight = 12;
  const barX = 40;
  const barY = 62;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const gradientId = "map-legend-gradient";
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const isMobility = isMobilityMetric(metricKey);
  const legendTitle = isMobility ? "Mobility rate (%)" : "GDP per capita (US$)";
  const legendDescription = isMobility
    ? "Percent of students connected to international study"
    : "Average income per person";

  const stopCount = 12;
  for (let i = 0; i <= stopCount; i += 1) {
    const t = i / stopCount;
    const value = scaleMin + t * (scaleMax - scaleMin);
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", mapColorScale(value));
  }

  svg
    .append("text")
    .attr("x", barX)
    .attr("y", 22)
    .attr("font-size", 11)
    .attr("fill", "#334155")
    .text(legendTitle);

  svg
    .append("text")
    .attr("x", barX)
    .attr("y", 38)
    .attr("font-size", 10)
    .attr("fill", "#64748b")
    .text(legendDescription);

  svg
    .append("rect")
    .attr("x", barX)
    .attr("y", barY)
    .attr("width", barWidth)
    .attr("height", barHeight)
    .attr("fill", `url(#${gradientId})`)
    .attr("stroke", "#cbd5e1");

  svg
    .append("text")
    .attr("x", barX)
    .attr("y", barY + 30)
    .attr("font-size", 11)
    .attr("fill", "#334155")
    .text(isMobility ? `${formatNumber(minValue === 0 ? scaleMin : minValue)}%` : formatMoney(minValue));

  svg
    .append("text")
    .attr("x", barX + barWidth)
    .attr("y", barY + 30)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#334155")
    .text(isMobility ? `${formatNumber(maxValue)}%` : formatMoney(maxValue));
}

function updateMap(metricKey) {
  mapMetricKey = metricKey;
  const isMobility = isMobilityMetric(metricKey);
  const mapTitles = {
    inbound_pct: "Map: Inbound student mobility (%)",
    outbound_pct: "Map: Outbound student mobility (%)",
    gdp_per_capita: "Map: GDP per capita (US$)",
  };
  const yearSuffix = Number.isFinite(mapCurrentYear) ? ` during ${mapCurrentYear}` : "";

  d3.select("#map-title").text(`${mapTitles[metricKey] || mapTitles.inbound_pct}${yearSuffix}`);

  const values = mapBaseRows
    .map((d) => d[metricKey])
    .filter((value) => Number.isFinite(value));
  const positiveValues = values.filter((value) => value > 0);

  const minValue = d3.min(values) ?? 0;
  const maxValue = d3.max(values) ?? 1;

  let scaleMin = d3.min(positiveValues) ?? 0;
  let scaleMax = maxValue;
  if (scaleMin === scaleMax) {
    scaleMax = scaleMin + 1;
  }

  const mobilityBlueInterpolator = d3.interpolateRgbBasis([
    "#f8fbff",
    "#e0f2fe",
    "#bae6fd",
    "#7dd3fc",
    "#38bdf8",
    "#0ea5e9",
    "#0284c7",
    "#1d4ed8",
    "#1e3a8a",
    "#172554",
  ]);

  mapColorScale = isMobility
    ? d3
        .scaleSequentialPow(mobilityBlueInterpolator)
        .domain([scaleMin, scaleMax])
        .exponent(0.45)
        .clamp(true)
    : d3.scaleSequential(d3.interpolateGreens).domain([scaleMin, scaleMax]);

  mapCountries.attr("fill", (d) => {
    const value = d.row?.[metricKey];
    if (!d.row) return "#e5e7eb";

    const isVisible = !mapVisibleKeySet || mapVisibleKeySet.has(getRowKey(d.row));
    if (!isVisible) return "#f3f4f6";

    if (!Number.isFinite(value)) return "#e5e7eb";
    if (value === 0 && isMobility) return "#cbd5e1";
    return mapColorScale(value);
  });

  drawLegend(minValue, maxValue, scaleMin, scaleMax, metricKey);
}

export function drawMap({ geojson, dataRows, selectedKeys, year }) {
  mapBaseRows = dataRows;
  mapVisibleKeySet = selectedKeys ? new Set(selectedKeys) : null;
  mapCurrentYear = year;

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const height = 360;
  const { g, innerWidth, innerHeight } = createChart({
    containerId: "#map",
    margin,
    height,
  });

  const projection = d3.geoNaturalEarth1().fitSize([innerWidth, innerHeight], geojson);
  const path = d3.geoPath(projection);

  const byIso = new Map(
    dataRows
      .filter((d) => typeof d.Code === "string" && d.Code.length === 3)
      .map((d) => [d.Code.toUpperCase(), d])
  );

  const byName = new Map(dataRows.map((d) => [normalizeName(d.Entity), d]));

  const countriesWithData = geojson.features.map((feature) => {
    const iso3 = getFeatureIso3(feature);
    const featureName = getFeatureName(feature);

    let row = null;
    if (iso3 && byIso.has(iso3)) {
      row = byIso.get(iso3);
    } else {
      const nameKey = normalizeName(featureName);
      row = byName.get(nameKey) || null;
    }

    return { feature, featureName, row };
  });

  mapCountries = g
    .selectAll("path")
    .data(countriesWithData)
    .join("path")
    .attr("class", "country")
    .attr("d", (d) => path(d.feature))
    .on("mousemove", (event, d) => {
      d3.select(event.currentTarget).attr("stroke", "#111827").attr("stroke-width", 1.4);

      if (!d.row) {
        showTooltip(event, `<strong>${d.featureName}</strong><br/>No data`);
        return;
      }

      const isVisible = !mapVisibleKeySet || mapVisibleKeySet.has(getRowKey(d.row));
      if (!isVisible) {
        showTooltip(
          event,
          `<strong>${d.row.Entity}</strong><br/>Filtered out by current brush selection`
        );
        return;
      }

      showTooltip(
        event,
        `<strong>${d.row.Entity}</strong><br/>Inbound: ${formatMaybe(
          d.row.inbound_pct
        )}<br/>Outbound: ${formatMaybe(
          d.row.outbound_pct
        )}<br/>GDP per capita: ${formatMoney(d.row.gdp_per_capita)}<br/>Year: ${d.row.Year}`
      );
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).attr("stroke", "#ffffff").attr("stroke-width", 0.6);
      hideTooltip();
    });

  d3.select("#map-metric")
    .property("value", mapMetricKey)
    .on("change", function () {
      updateMap(this.value);
    });

  updateMap(mapMetricKey);
}
