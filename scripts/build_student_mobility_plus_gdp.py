import csv
from pathlib import Path

MOBILITY_PATH = Path("data/student-mobility-merged.csv")
GDP_PATH = Path("data/gdp-per-capita-worldbank.csv")
OUTPUT_PATH = Path("data/student-mobility-merged-plus-gdp.csv")


def to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def to_float_or_blank(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return ""


def is_country_code(code):
    code = (code or "").strip()
    return len(code) == 3 and code.isalpha()


def find_gdp_column(fieldnames):
    # OWID grapher files are usually Entity, Code, Year, <value>, ...
    blocked = {"entity", "code", "year", "owid_region"}
    for name in fieldnames:
        if name.lower() not in blocked:
            return name
    raise ValueError("Could not find GDP value column.")


def load_gdp_lookup():
    lookup = {}
    with GDP_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        gdp_col = find_gdp_column(reader.fieldnames or [])

        for row in reader:
            code = (row.get("code") or row.get("Code") or "").upper().strip()
            year = to_int(row.get("year") or row.get("Year"))
            gdp = to_float_or_blank(row.get(gdp_col))

            if not is_country_code(code) or year is None:
                continue

            lookup[(code, year)] = gdp

    return lookup


def build_rows():
    gdp_lookup = load_gdp_lookup()
    merged = []

    with MOBILITY_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("Code") or "").upper().strip()
            year = to_int(row.get("Year"))

            if not is_country_code(code) or year is None:
                continue

            merged.append(
                {
                    "Entity": row.get("Entity", ""),
                    "Code": code,
                    "Year": year,
                    "inbound_pct": to_float_or_blank(row.get("inbound_pct")),
                    "outbound_pct": to_float_or_blank(row.get("outbound_pct")),
                    "gdp_per_capita": gdp_lookup.get((code, year), ""),
                }
            )

    merged.sort(key=lambda r: (r["Year"], r["Code"]))
    return merged


def write_rows(rows):
    fieldnames = ["Entity", "Code", "Year", "inbound_pct", "outbound_pct", "gdp_per_capita"]
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = build_rows()
    write_rows(rows)
    years = sorted({r["Year"] for r in rows})

    print("Saved:", OUTPUT_PATH)
    print("Rows:", len(rows))
    if years:
        print("Years:", years[0], "to", years[-1])


if __name__ == "__main__":
    main()
