import { createChart, formatNumber, hideTooltip, showTooltip } from "./chart-utils.js";

// Scatterplot brush filters countries by rectangular inbound/outbound range.
export function drawScatter({ allRows, filteredRows, activeBrush, enableBrush, onBrushEnd }) {
  const margin = { top: 20, right: 20, bottom: 54, left: 58 };
  const height = 320;
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

  if (enableBrush) {
    const brush = d3
      .brush()
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

        const [[x0, y0], [x1, y1]] = event.selection;
        const outboundRaw = [x.invert(x0), x.invert(x1)];
        const inboundRaw = [y.invert(y0), y.invert(y1)];

        onBrushEnd({
          outbound: [Math.min(outboundRaw[0], outboundRaw[1]), Math.max(outboundRaw[0], outboundRaw[1])],
          inbound: [Math.min(inboundRaw[0], inboundRaw[1]), Math.max(inboundRaw[0], inboundRaw[1])],
        });
      });

    const brushLayer = g.append("g").attr("class", "brush").call(brush);
    if (activeBrush) {
      brushLayer.call(brush.move, [
        [x(activeBrush.outbound[0]), y(activeBrush.inbound[1])],
        [x(activeBrush.outbound[1]), y(activeBrush.inbound[0])],
      ]);
    }
  }
}
