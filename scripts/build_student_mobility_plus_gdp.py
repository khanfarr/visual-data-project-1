import csv
from pathlib import Path

MOBILITY_PATH = Path("data/student-mobility-merged.csv")
GDP_PATH = Path("data/gdp-per-capita-worldbank.csv")
OUTPUT_PATH = Path("data/student-mobility-merged-plus-gdp.csv")


def is_real_country_code(code):
    code = (code or "").strip()
    return len(code) == 3 and code.isalpha()


def to_float_or_empty(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return ""


def to_int_or_none(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def find_gdp_value_column(fieldnames):
    lower_map = {name.lower(): name for name in fieldnames}
    excluded = {"entity", "code", "year", "owid_region", "country"}

    for lower_name, original_name in lower_map.items():
        if lower_name not in excluded:
            return original_name

    raise ValueError("Could not find GDP value column in gdp-per-capita-worldbank.csv")


def load_gdp_lookup():
    with GDP_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        gdp_col = find_gdp_value_column(reader.fieldnames or [])
        lookup = {}

        for row in reader:
            code = (row.get("code") or row.get("Code") or "").strip()
            year = to_int_or_none(row.get("year") or row.get("Year"))
            gdp_value = to_float_or_empty(row.get(gdp_col))

            if not is_real_country_code(code) or year is None:
                continue

            lookup[(code.upper(), year)] = gdp_value

    return lookup


def build_output():
    gdp_lookup = load_gdp_lookup()
    out_rows = []

    with MOBILITY_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("Code") or "").strip()
            year = to_int_or_none(row.get("Year"))

            if not is_real_country_code(code) or year is None:
                continue

            out_rows.append(
                {
                    "Entity": row.get("Entity", ""),
                    "Code": code.upper(),
                    "Year": year,
                    "inbound_pct": to_float_or_empty(row.get("inbound_pct")),
                    "outbound_pct": to_float_or_empty(row.get("outbound_pct")),
                    "gdp_per_capita": gdp_lookup.get((code.upper(), year), ""),
                }
            )

    out_rows.sort(key=lambda r: (r["Year"], r["Code"]))
    return out_rows


def write_output(rows):
    fieldnames = ["Entity", "Code", "Year", "inbound_pct", "outbound_pct", "gdp_per_capita"]
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = build_output()
    write_output(rows)
    years = sorted({r["Year"] for r in rows})

    print("Saved:", OUTPUT_PATH)
    print("Rows:", len(rows))
    if years:
        print("Years:", years[0], "to", years[-1], f"({len(years)} years)")


if __name__ == "__main__":
    main()
