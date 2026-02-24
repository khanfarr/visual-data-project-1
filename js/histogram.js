import { createChart, formatNumber, hideTooltip, showTooltip } from "./chart-utils.js";

// Histogram brush filters countries by value range - bars are redrawn from the filtered set.
export function drawHistogram({
  containerId,
  allRows,
  filteredRows,
  metricKey,
  xLabel,
  activeRange,
  onBrushEnd,
}) {
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
        onBrushEnd(null);
        return;
      }

      const [rawMin, rawMax] = event.selection.map((pixel) => x.invert(pixel));
      onBrushEnd([Math.min(rawMin, rawMax), Math.max(rawMin, rawMax)]);
    });

  const brushLayer = g.append("g").attr("class", "brush").call(brush);
  if (activeRange) {
    brushLayer.call(brush.move, [x(activeRange[0]), x(activeRange[1])]);
  }
}
