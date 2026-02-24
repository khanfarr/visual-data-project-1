import { getRowKey } from "./chart-utils.js";
import { drawHistogram } from "./histogram.js";
import { drawMap } from "./map.js";
import { drawScatter } from "./scatter.js";

const DATA_PATH = "data/student-mobility-merged-plus-gdp.csv";
const WORLD_GEOJSON_URL =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

let mapYears = [];
let mapGeojson = null;
let appRows = [];

const state = {
  mapYear: null,
  selectedKeys: null,
  histBrush: {
    inbound_pct: null,
    outbound_pct: null,
  },
  scatterBrush: null,
};

function getAnalysisRows() {
  const activeYear = state.mapYear ?? d3.max(appRows, (d) => d.Year);
  return appRows.filter((d) => d.Year === activeYear);
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
    summary.text(`Showing all ${totalCount} countries. Brush one of the charts below the map to filter by country.`);
    return;
  }

  summary.text(`Showing ${selectedCount} of ${totalCount} countries from brushed selection.`);
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

function renderMapForYear(year) {
  state.mapYear = year;
  d3.select("#map-year-value").text(year ?? "N/A");
  drawMap({
    geojson: mapGeojson,
    dataRows: getMapRowsForYear(year),
    selectedKeys: state.selectedKeys,
    year,
  });
}

function updateChartTitles(year) {
  const yearText = Number.isFinite(year) ? ` during ${year}` : "";
  d3.select("#hist-inbound-title").text(
    `Inbound student mobility (%)${yearText}`
  );
  d3.select("#hist-outbound-title").text(
    `Outbound student mobility (%)${yearText}`
  );
  d3.select("#scatter-title").text(
    `Outbound vs Inbound mobility${yearText}`
  )
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
      state.mapYear = mapYears[index];
      renderDashboard();
    });
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
  const activeYear = state.mapYear ?? null;

  updateChartTitles(activeYear);
  computeSelection(analysisRows);
  const filteredRows = getFilteredRows(analysisRows);

  drawHistogram({
    containerId: "#hist-inbound",
    allRows: analysisRows,
    filteredRows,
    metricKey: "inbound_pct",
    xLabel: "Inbound mobility (%)",
    activeRange: state.histBrush.inbound_pct,
    onBrushEnd: (range) => {
      state.histBrush.inbound_pct = range;
      renderDashboard();
    },
  });

  drawHistogram({
    containerId: "#hist-outbound",
    allRows: analysisRows,
    filteredRows,
    metricKey: "outbound_pct",
    xLabel: "Outbound mobility (%)",
    activeRange: state.histBrush.outbound_pct,
    onBrushEnd: (range) => {
      state.histBrush.outbound_pct = range;
      renderDashboard();
    },
  });

  drawScatter({
    allRows: analysisRows,
    filteredRows,
    activeBrush: state.scatterBrush,
    onBrushEnd: (brush) => {
      state.scatterBrush = brush;
      renderDashboard();
    },
  });

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
