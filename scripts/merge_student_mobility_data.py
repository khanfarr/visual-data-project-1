import csv
from pathlib import Path

INBOUND_PATH = Path("data/share-of-students-from-abroad.csv")
OUTBOUND_PATH = Path("data/share-of-students-studying-abroad.csv")

OUT_ALL_YEARS_HYPHEN = Path("data/student-mobility-merged.csv")
OUT_ALL_YEARS_UNDERSCORE = Path("data/student-mobility-merged.csv")


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_year(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def load_metric_rows(path, metric_col_name):
    data = {}
    years = set()

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("Code") or "").strip()
            year = parse_year(row.get("Year"))
            metric = parse_float(row.get(metric_col_name))
            entity = (row.get("Entity") or "").strip()

            if not code or year is None or metric is None:
                continue

            key = (code, year)
            data[key] = {"Entity": entity, "Code": code, "Year": year, "value": metric}
            years.add(year)

    return data, years


def build_merged_rows(inbound_rows, outbound_rows):
    merged = []

    common_keys = sorted(inbound_rows.keys() & outbound_rows.keys(), key=lambda k: (k[1], k[0]))
    for key in common_keys:
        inb = inbound_rows[key]
        outb = outbound_rows[key]
        entity = inb["Entity"] or outb["Entity"]
        merged.append(
            {
                "Entity": entity,
                "Code": inb["Code"],
                "Year": inb["Year"],
                "inbound_pct": inb["value"],
                "outbound_pct": outb["value"],
            }
        )

    return merged


def write_csv(path, rows):
    fieldnames = ["Entity", "Code", "Year", "inbound_pct", "outbound_pct"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    inbound_rows, inbound_years = load_metric_rows(
        INBOUND_PATH, "Inbound mobility rate, both sexes"
    )
    outbound_rows, outbound_years = load_metric_rows(
        OUTBOUND_PATH, "Share of students studying abroad"
    )

    merged_rows = build_merged_rows(inbound_rows, outbound_rows)
    write_csv(OUT_ALL_YEARS_HYPHEN, merged_rows)
    write_csv(OUT_ALL_YEARS_UNDERSCORE, merged_rows)

    years = sorted({row["Year"] for row in merged_rows})

    print("Saved:", OUT_ALL_YEARS_HYPHEN)
    print("Saved:", OUT_ALL_YEARS_UNDERSCORE)
    print("Inbound years:", min(inbound_years), "to", max(inbound_years))
    print("Outbound years:", min(outbound_years), "to", max(outbound_years))
    print("Merged year count:", len(years))
    print("Merged years:", years[0], "to", years[-1])
    print("Rows (all years):", len(merged_rows))


if __name__ == "__main__":
    main()
