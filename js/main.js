const DATA_PATH = "data/student-mobility-merged.csv";
const WORLD_GEOJSON_URL =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

const tooltip = d3.select("#tooltip");
let mapCountries;
let mapColorScale;
let mapMetricKey = "inbound_pct";
let mapDataRows = [];
let mapAllRows = [];
let mapYears = [];
let mapGeojson = null;

function formatNumber(value) {
  return d3.format(".2f")(value);
}

function formatMaybe(value) {
  return Number.isFinite(value) ? `${formatNumber(value)}%` : "N/A";
}

function drawHistogram({ containerId, values, xLabel }) {
  const container = d3.select(containerId);
  container.selectAll("*").remove();

  const margin = { top: 20, right: 20, bottom: 52, left: 56 };
  const width = Math.max(container.node().clientWidth, 320);
  const height = 320;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xMin = 0;
  const xMax = d3.max(values) ?? 0;

  const x = d3
    .scaleLinear()
    .domain([xMin, xMax])
    .nice()
    .range([0, innerWidth]);

  const bins = d3
    .bin()
    .domain(x.domain())
    .thresholds(20)(values);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length) || 1])
    .nice()
    .range([innerHeight, 0]);

  g.selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", (d) => innerHeight - y(d.length))
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`)
        .html(
          `Range: ${formatNumber(d.x0)}% to ${formatNumber(d.x1)}%<br/>Countries: ${d.length}`
        );
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

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
}

function drawScatter(data) {
  const container = d3.select("#scatter");
  container.selectAll("*").remove();

  const margin = { top: 20, right: 20, bottom: 54, left: 58 };
  const width = Math.max(container.node().clientWidth, 320);
  const height = 360;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.outbound_pct) || 1])
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.inbound_pct) || 1])
    .nice()
    .range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g").call(d3.axisLeft(y));

  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.outbound_pct))
    .attr("cy", (d) => y(d.inbound_pct))
    .attr("r", 4)
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`)
        .html(
          `<strong>${d.Entity}</strong><br/>Inbound: ${formatNumber(d.inbound_pct)}%<br/>Outbound: ${formatNumber(d.outbound_pct)}%<br/>Year: ${d.Year}`
        );
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

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
}

function parseRow(row) {
  return {
    Entity: row.Entity,
    Code: row.Code,
    Year: +row.Year,
    inbound_pct: +row.inbound_pct,
    outbound_pct: +row.outbound_pct,
  };
}

function setActiveMetricButton(metricKey) {
  d3.selectAll(".map-toggle-btn").classed("active", false);
  d3.selectAll(".map-toggle-btn")
    .filter(function () {
      return this.dataset.metric === metricKey;
    })
    .classed("active", true);
}

function getMapRowsForYear(year) {
  return mapAllRows.filter((d) => d.Year === year);
}

function renderMapForYear(year) {
  d3.select("#map-year-value").text(year ?? "N/A");
  drawMap(mapGeojson, getMapRowsForYear(year));
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
      const selectedYear = mapYears[index];
      renderMapForYear(selectedYear);
    });

  renderMapForYear(mapYears[mapYears.length - 1]);
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

function drawLegend(minValue, maxValue, scaleMin, scaleMax) {
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

  if (minValue === 0 && maxValue > 0) {
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
    .text("Mobility rate (%)");

  svg
    .append("text")
    .attr("x", barX)
    .attr("y", 38)
    .attr("font-size", 10)
    .attr("fill", "#64748b")
    .text("Percent of students connected to international study");

  if (minValue === 0) {
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
    .text(`${formatNumber(minValue === 0 ? scaleMin : minValue)}%`);

  svg
    .append("text")
    .attr("x", barX + barWidth)
    .attr("y", barY + 30)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#334155")
    .text(`${formatNumber(maxValue)}%`);
}

function updateMap(metricKey) {
  mapMetricKey = metricKey;

  const title =
    metricKey === "inbound_pct"
      ? "Map: Inbound student mobility (%)"
      : "Map: Outbound student mobility (%)";
  d3.select("#map-title").text(title);

  const values = mapDataRows
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

  mapColorScale = d3
    .scaleSequential((t) => d3.interpolateLab("#7fb3d5", "#08306b")(t))
    .domain([scaleMin, scaleMax]);

  mapCountries.attr("fill", (d) => {
    const value = d.row?.[metricKey];
    if (!Number.isFinite(value)) return "#e5e7eb";
    if (value === 0) return "#cbd5e1";
    return mapColorScale(value);
  });

  drawLegend(minValue, maxValue, scaleMin, scaleMax);
}

function drawMap(geojson, dataRows) {
  mapDataRows = dataRows;

  const container = d3.select("#map");
  container.selectAll("*").remove();

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const width = Math.max(container.node().clientWidth, 320);
  const height = 360;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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
      // Name matching fallback for GeoJSON files that do not include ISO-3 codes.
      // This may be imperfect because country names can differ across datasets.
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
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 28}px`)
          .html(`<strong>${d.featureName}</strong><br/>No data`);
        return;
      }

      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`)
        .html(
          `<strong>${d.row.Entity}</strong><br/>Inbound: ${formatMaybe(
            d.row.inbound_pct
          )}<br/>Outbound: ${formatMaybe(d.row.outbound_pct)}<br/>Year: ${d.row.Year}`
        );
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).attr("stroke", "#ffffff").attr("stroke-width", 0.6);
      tooltip.style("opacity", 0);
    });

  d3.selectAll(".map-toggle-btn").on("click", function () {
    const metric = this.dataset.metric;
    setActiveMetricButton(metric);
    updateMap(metric);
  });

  setActiveMetricButton(mapMetricKey);
  updateMap(mapMetricKey);
}

Promise.all([d3.csv(DATA_PATH, parseRow), d3.json(WORLD_GEOJSON_URL)])
  .then(([rows, worldGeojson]) => {
    const validRows = rows.filter(
      (d) =>
        Number.isFinite(d.Year) &&
        Number.isFinite(d.inbound_pct) &&
        Number.isFinite(d.outbound_pct)
    );

    const yearShown = d3.max(validRows, (d) => d.Year);
    const filtered = validRows.filter((d) => d.Year === yearShown);
    mapAllRows = validRows;
    mapYears = Array.from(new Set(validRows.map((d) => d.Year))).sort((a, b) => a - b);
    mapGeojson = worldGeojson;

    d3.select("#year-value").text(yearShown ?? "N/A");

    drawHistogram({
      containerId: "#hist-inbound",
      values: filtered.map((d) => d.inbound_pct),
      xLabel: "Inbound mobility (%)",
    });

    drawHistogram({
      containerId: "#hist-outbound",
      values: filtered.map((d) => d.outbound_pct),
      xLabel: "Outbound mobility (%)",
    });

    drawScatter(filtered);
    setupMapTimeline();
  })
  .catch((error) => {
    console.error("Failed to load dashboard data:", error);
    d3.select("#year-value").text("Could not load data");
    d3.select("#map").text("Could not load map data.");
  });
