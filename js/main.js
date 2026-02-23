const DATA_PATH = "data/student-mobility-merged.csv";

const tooltip = d3.select("#tooltip");

function formatNumber(value) {
  return d3.format(".2f")(value);
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
    .attr("height", (d) => innerHeight - y(d.length));

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

d3.csv(DATA_PATH, parseRow)
  .then((rows) => {
    const validRows = rows.filter(
      (d) =>
        Number.isFinite(d.Year) &&
        Number.isFinite(d.inbound_pct) &&
        Number.isFinite(d.outbound_pct)
    );

    const yearShown = d3.max(validRows, (d) => d.Year);
    const filtered = validRows.filter((d) => d.Year === yearShown);

    d3.select("#year-value").text(yearShown ?? "N/A");

    // Chart 1 starts here: histogram for inbound mobility
    drawHistogram({
      containerId: "#hist-inbound",
      values: filtered.map((d) => d.inbound_pct),
      xLabel: "Inbound mobility (%)",
    });
  })

