const DATA_PATH = "data/student-mobility-merged-plus-gdp.csv";
const WORLD_GEOJSON_URL =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

const tooltip = d3.select("#tooltip");

let mapCountries;
let mapColorScale;
let mapMetricKey = "inbound_pct";
let mapBaseRows = [];
let mapVisibleKeySet = null;
let mapYears = [];
let mapGeojson = null;
let appRows = [];

const MIN_CHART_WIDTH = 320;

const state = {
  analysisYear: null,
  mapYear: null,
  selectedKeys: null,
  histBrush: {
    inbound_pct: null,
    outbound_pct: null,
  },
  scatterBrush: null,
};

function createChart({ containerId, margin, height }) {
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

function showTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY - 28}px`)
    .html(html);
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

function formatNumber(value) {
  return d3.format(".2f")(value);
}

function formatMaybe(value) {
  return Number.isFinite(value) ? `${formatNumber(value)}%` : "N/A";
}

function formatMoney(value) {
  return Number.isFinite(value) ? `$${d3.format(",.0f")(value)}` : "N/A";
}

function getRowKey(row) {
  if (typeof row.Code === "string" && row.Code.length === 3) {
    return row.Code.toUpperCase();
  }
  return row.Entity;
}

function getAnalysisRows() {
  return appRows.filter((d) => d.Year === state.analysisYear);
}

function getMapRowsForYear(year) {
  return appRows.filter((d) => d.Year === year);
}

function getFilteredRows(rows) {
  if (!state.selectedKeys) return rows;
  return rows.filter((d) => state.selectedKeys.has(getRowKey(d)));
}

function computeSelection(rows) {
  let currentSelection = null;

  function intersect(nextSet) {
    if (currentSelection === null) {
      currentSelection = nextSet;
      return;
    }
    currentSelection = new Set([...currentSelection].filter((key) => nextSet.has(key)));
  }

  const inboundRange = state.histBrush.inbound_pct;
  if (inboundRange) {
    const [minValue, maxValue] = inboundRange;
    intersect(
      new Set(
        rows
          .filter((d) => d.inbound_pct >= minValue && d.inbound_pct <= maxValue)
          .map((d) => getRowKey(d))
      )
    );
  }

  const outboundRange = state.histBrush.outbound_pct;
  if (outboundRange) {
    const [minValue, maxValue] = outboundRange;
    intersect(
      new Set(
        rows
          .filter((d) => d.outbound_pct >= minValue && d.outbound_pct <= maxValue)
          .map((d) => getRowKey(d))
      )
    );
  }

  if (state.scatterBrush) {
    const { outbound, inbound } = state.scatterBrush;
    intersect(
      new Set(
        rows
          .filter(
            (d) =>
              d.outbound_pct >= outbound[0] &&
              d.outbound_pct <= outbound[1] &&
              d.inbound_pct >= inbound[0] &&
              d.inbound_pct <= inbound[1]
          )
          .map((d) => getRowKey(d))
      )
    );
  }

  state.selectedKeys = currentSelection;
}

function updateSelectionSummary(totalCount, selectedCount) {
  const summary = d3.select("#selection-summary");
  if (summary.empty()) return;

  if (!state.selectedKeys) {
    summary.text(`Showing all ${totalCount} countries. Brush a chart to filter.`);
    return;
  }

  summary.text(`Showing ${selectedCount} of ${totalCount} countries from brushed selection.`);
}

// Histogram brush filters countries by value range; bars are redrawn from the filtered set.
function drawHistogram({ containerId, allRows, filteredRows, metricKey, xLabel }) {
  const margin = { top: 20, right: 20, bottom: 52, left: 56 };
  const height = 320;
  const { g, innerWidth, innerHeight } = createChart({ containerId, margin, height });

  const allValues = allRows.map((d) => d[metricKey]);
  const filteredValues = filteredRows.map((d) => d[metricKey]);

  const xMin = 0;
  const xMax = d3.max(allValues) ?? 0;

  const x = d3
    .scaleLinear()
    .domain([xMin, xMax])
    .nice()
    .range([0, innerWidth]);

  const binGenerator = d3.bin().domain(x.domain()).thresholds(20);
  const allBins = binGenerator(allValues);
  const filteredBins = binGenerator(filteredValues);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allBins, (d) => d.length) || 1])
    .nice()
    .range([innerHeight, 0]);

  g.selectAll("rect")
    .data(filteredBins)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", (d) => innerHeight - y(d.length))
    .on("mousemove", (event, d) => {
      showTooltip(
        event,
        `Range: ${formatNumber(d.x0)}% to ${formatNumber(d.x1)}%<br/>Countries: ${d.length}`
      );
    })
    .on("mouseleave", hideTooltip);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g").call(d3.axisLeft(y).ticks(6));

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .text(xLabel);

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .text("Count of countries");

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("end", (event) => {
      if (!event.sourceEvent) return;

      if (!event.selection) {
        state.histBrush[metricKey] = null;
        renderDashboard();
        return;
      }

      const [rawMin, rawMax] = event.selection.map((pixel) => x.invert(pixel));
      const minValue = Math.min(rawMin, rawMax);
      const maxValue = Math.max(rawMin, rawMax);
      state.histBrush[metricKey] = [minValue, maxValue];
      renderDashboard();
    });

  const brushLayer = g.append("g").attr("class", "brush").call(brush);
  const activeRange = state.histBrush[metricKey];
  if (activeRange) {
    brushLayer.call(brush.move, [x(activeRange[0]), x(activeRange[1])]);
  }
}

// Scatterplot brush filters countries by rectangular inbound/outbound range.
function drawScatter({ allRows, filteredRows }) {
  const margin = { top: 20, right: 20, bottom: 54, left: 58 };
  const height = 360;
  const { g, innerWidth, innerHeight } = createChart({
    containerId: "#scatter",
    margin,
    height,
  });

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(allRows, (d) => d.outbound_pct) || 1])
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allRows, (d) => d.inbound_pct) || 1])
    .nice()
    .range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g").call(d3.axisLeft(y));

  g.selectAll("circle")
    .data(filteredRows)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.outbound_pct))
    .attr("cy", (d) => y(d.inbound_pct))
    .attr("r", 4)
    .on("mousemove", (event, d) => {
      showTooltip(
        event,
        `<strong>${d.Entity}</strong><br/>Inbound: ${formatNumber(
          d.inbound_pct
        )}%<br/>Outbound: ${formatNumber(d.outbound_pct)}%<br/>Year: ${d.Year}`
      );
    })
    .on("mouseleave", hideTooltip);

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 42)
    .attr("text-anchor", "middle")
    .text("Outbound mobility (%)");

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .text("Inbound mobility (%)");

  const brush = d3
    .brush()
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("end", (event) => {
      if (!event.sourceEvent) return;

      if (!event.selection) {
        state.scatterBrush = null;
        renderDashboard();
        return;
      }

      const [[x0, y0], [x1, y1]] = event.selection;
      const outboundRaw = [x.invert(x0), x.invert(x1)];
      const inboundRaw = [y.invert(y0), y.invert(y1)];

      state.scatterBrush = {
        outbound: [Math.min(outboundRaw[0], outboundRaw[1]), Math.max(outboundRaw[0], outboundRaw[1])],
        inbound: [Math.min(inboundRaw[0], inboundRaw[1]), Math.max(inboundRaw[0], inboundRaw[1])],
      };

      renderDashboard();
    });

  const brushLayer = g.append("g").attr("class", "brush").call(brush);
  if (state.scatterBrush) {
    brushLayer.call(brush.move, [
      [x(state.scatterBrush.outbound[0]), y(state.scatterBrush.inbound[1])],
      [x(state.scatterBrush.outbound[1]), y(state.scatterBrush.inbound[0])],
    ]);
  }
}

function parseRow(row) {
  return {
    Entity: row.Entity,
    Code: row.Code,
    Year: +row.Year,
    inbound_pct: +row.inbound_pct,
    outbound_pct: +row.outbound_pct,
    gdp_per_capita: +row.gdp_per_capita,
  };
}

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFeatureName(feature) {
  const props = feature.properties || {};
  return props.name || props.NAME || props.admin || props.ADMIN || "Unknown";
}

function getFeatureIso3(feature) {
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

  const isGdpMetric = metricKey === "gdp_per_capita";
  const legendTitle = isGdpMetric ? "GDP per capita (US$)" : "Mobility rate (%)";
  const legendDescription = isGdpMetric
    ? "Average income per person"
    : "Percent of students connected to international study";

  if (minValue === 0 && maxValue > 0 && !isGdpMetric) {
    const rawZeroOffset = (scaleMin / maxValue) * 100;
    const zeroOffset = Math.max(2, Math.min(rawZeroOffset, 12));
    const blendOffset = Math.min(zeroOffset + 4, 18);
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#cbd5e1");
    gradient.append("stop").attr("offset", `${zeroOffset}%`).attr("stop-color", "#cbd5e1");
    gradient
      .append("stop")
      .attr("offset", `${blendOffset}%`)
      .attr("stop-color", mapColorScale(scaleMin));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", mapColorScale(scaleMax));
  } else {
    gradient.append("stop").attr("offset", "0%").attr("stop-color", mapColorScale(scaleMin));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", mapColorScale(scaleMax));
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

  if (minValue === 0 && !isGdpMetric) {
    svg
      .append("text")
      .attr("x", barX)
      .attr("y", 50)
      .attr("font-size", 10)
      .attr("fill", "#64748b")
      .text("0% is shown as gray on the map");
  }

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
    .text(isGdpMetric ? formatMoney(minValue) : `${formatNumber(minValue === 0 ? scaleMin : minValue)}%`);

  svg
    .append("text")
    .attr("x", barX + barWidth)
    .attr("y", barY + 30)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#334155")
    .text(isGdpMetric ? formatMoney(maxValue) : `${formatNumber(maxValue)}%`);
}

function updateMap(metricKey) {
  mapMetricKey = metricKey;
  const isGdpMetric = metricKey === "gdp_per_capita";
  const mapTitles = {
    inbound_pct: "Map: Inbound student mobility (%)",
    outbound_pct: "Map: Outbound student mobility (%)",
    gdp_per_capita: "Map: GDP per capita (US$)",
  };

  d3.select("#map-title").text(mapTitles[metricKey] || mapTitles.inbound_pct);

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

  mapColorScale = isGdpMetric
    ? d3.scaleSequential(d3.interpolateGreens).domain([scaleMin, scaleMax])
    : d3.scaleSequential((t) => d3.interpolateLab("#7fb3d5", "#08306b")(t)).domain([
        scaleMin,
        scaleMax,
      ]);

  mapCountries.attr("fill", (d) => {
    const value = d.row?.[metricKey];
    if (!d.row) return "#e5e7eb";

    const isVisible = !mapVisibleKeySet || mapVisibleKeySet.has(getRowKey(d.row));
    if (!isVisible) return "#f3f4f6";

    if (!Number.isFinite(value)) return "#e5e7eb";
    if (value === 0 && !isGdpMetric) return "#cbd5e1";
    return mapColorScale(value);
  });

  drawLegend(minValue, maxValue, scaleMin, scaleMax, metricKey);
}

function drawMap(geojson, dataRows, selectedKeys) {
  mapBaseRows = dataRows;
  mapVisibleKeySet = selectedKeys ? new Set(selectedKeys) : null;

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

function renderMapForYear(year) {
  state.mapYear = year;
  d3.select("#map-year-value").text(year ?? "N/A");
  drawMap(mapGeojson, getMapRowsForYear(year), state.selectedKeys);
}

function setupMapTimeline() {
  const slider = d3.select("#map-year-slider");
  if (mapYears.length === 0) {
    slider.property("disabled", true);
    d3.select("#map-year-value").text("N/A");
    return;
  }

  slider
    .attr("min", 0)
    .attr("max", Math.max(0, mapYears.length - 1))
    .attr("step", 1)
    .property("value", mapYears.length - 1)
    .property("disabled", mapYears.length === 1)
    .on("input", function () {
      const index = +this.value;
      renderMapForYear(mapYears[index]);
    });

  renderMapForYear(mapYears[mapYears.length - 1]);
}

function clearBrushes() {
  state.histBrush.inbound_pct = null;
  state.histBrush.outbound_pct = null;
  state.scatterBrush = null;
  state.selectedKeys = null;
  renderDashboard();
}

function renderDashboard() {
  const analysisRows = getAnalysisRows();
  computeSelection(analysisRows);
  const filteredRows = getFilteredRows(analysisRows);

  drawHistogram({
    containerId: "#hist-inbound",
    allRows: analysisRows,
    filteredRows,
    metricKey: "inbound_pct",
    xLabel: "Inbound mobility (%)",
  });

  drawHistogram({
    containerId: "#hist-outbound",
    allRows: analysisRows,
    filteredRows,
    metricKey: "outbound_pct",
    xLabel: "Outbound mobility (%)",
  });

  drawScatter({ allRows: analysisRows, filteredRows });

  if (state.mapYear !== null) {
    renderMapForYear(state.mapYear);
  }

  updateSelectionSummary(analysisRows.length, filteredRows.length);
}

Promise.all([d3.csv(DATA_PATH, parseRow), d3.json(WORLD_GEOJSON_URL)])
  .then(([rows, worldGeojson]) => {
    const validRows = rows.filter(
      (d) =>
        Number.isFinite(d.Year) &&
        Number.isFinite(d.inbound_pct) &&
        Number.isFinite(d.outbound_pct)
    );

    appRows = validRows;
    mapGeojson = worldGeojson;

    state.analysisYear = d3.max(validRows, (d) => d.Year);
    mapYears = Array.from(new Set(validRows.map((d) => d.Year))).sort((a, b) => a - b);
    state.mapYear = mapYears[mapYears.length - 1] ?? null;

    setupMapTimeline();
    renderDashboard();

    d3.select("#clear-brushes").on("click", clearBrushes);
  })
  .catch((error) => {
    console.error("Failed to load dashboard data:", error);
    d3.select("#map").text("Could not load map data.");
  });
