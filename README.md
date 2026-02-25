# Global Student Mobility Dashboard

Interactive D3 dashboard for exploring how countries send and receive international students over time.

Live site: https://visual-data-project-1.khansfareena.workers.dev/

<img src="./media/dashboard-screenshot.png" alt="Global Student Mobility dashboard" width="760" />

## Project Focus
- Compare countries that attract students (`inbound_pct`) vs countries whose students study abroad (`outbound_pct`).
- Explore global distributions, spatial patterns, and correlation between the two metrics.
- Add GDP per capita as an additional context metric on the map.

## Features
- Choropleth world map with metric toggle:
  - Inbound student mobility (%)
  - Outbound student mobility (%)
  - GDP per capita (US$)
- Year slider (1998-2022) to update the dashboard by year.
- Two linked histograms (inbound and outbound) with brush selection.
- Linked scatterplot (outbound vs inbound) with rectangular brush selection.
- Cross-filtered interactions across all views with a `Clear brushed selection` reset button.
- Tooltip details on demand for map, histogram bins, and scatter points.

## Data Sources
- OWID: [Share of students from abroad](https://ourworldindata.org/grapher/share-of-students-from-abroad?mapSelect=USA~ETH~LBY)
- OWID: [Share of students studying abroad](https://ourworldindata.org/grapher/share-of-students-studying-abroad?mapSelect=ARE~NER~DZA)
- OWID/World Bank: `gdp-per-capita-worldbank.csv`
- Map geometry: `world.geojson` from D3 Graph Gallery

## Data Processing
Input files:
- `data/share-of-students-from-abroad.csv` -> inbound metric
- `data/share-of-students-studying-abroad.csv` -> outbound metric
- `data/gdp-per-capita-worldbank.csv` -> GDP context metric

Scripts:
- `scripts/merge_student_mobility_data.py`: merges inbound + outbound by `Code` + `Year`
- `scripts/build_student_mobility_plus_gdp.py`: merges GDP into mobility dataset

Final app dataset:
- `data/student-mobility-merged-plus-gdp.csv`

## Run Locally
1. Start a local server from the repo root:
   - `python3 -m http.server 8000`
2. Open:
   - `http://localhost:8000`

## Repository Structure
- `index.html`: dashboard layout and controls
- `style.css`: styling and layout
- `js/main.js`: app state, data loading, linked updates
- `js/map.js`: choropleth rendering, legend, metric switching
- `js/histogram.js`: histogram rendering and brush interaction
- `js/scatter.js`: scatterplot rendering and brush interaction
- `js/chart-utils.js`: reusable chart helpers and tooltip utilities
- `scripts/`: preprocessing scripts
- `data/`: raw and merged CSV files

## Tech Stack + Versions
- Frontend: HTML, CSS, JavaScript (ES modules)
- Visualization library: D3.js v7 (loaded from jsDelivr CDN in `index.html`)
- Data preprocessing: Python 3 (scripts in `scripts/`)
- Deployment platform: Cloudflare Workers

## Interaction Guide
- Use the map metric dropdown to switch between inbound mobility, outbound mobility, and GDP per capita.
- Use the year slider to change the active year; this updates map and chart views together.
- Brush horizontally on either histogram to filter countries by a value range.
- Brush a rectangle on the scatterplot to filter countries by both outbound (x) and inbound (y) ranges.
- If multiple brushes are active, filters are combined using intersection (only countries meeting all active brush conditions remain).
- Click `Clear brushed selection` to remove all active brushes and show the full set again.

## Known Limitations
- GDP per capita is missing for some country-year records, so those rows can display `N/A` in tooltips or appear with no GDP value.
- Country matching on the map relies on ISO-3 codes first and normalized country names as fallback; some edge-case naming differences can still fail to match.
- Current linked filtering is designed around the selected year view, so cross-year comparisons are not shown simultaneously.
