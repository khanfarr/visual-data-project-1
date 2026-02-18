import pandas as pd

# Read your downloaded OWID files (keep these names exactly)
inb = pd.read_csv("data/share-of-students-from-abroad.csv")
outb = pd.read_csv("data/share-of-students-studying-abroad.csv")

# Rename the value columns to friendly names
inb = inb.rename(columns={inb.columns[-1]: "inbound_pct"})
outb = outb.rename(columns={outb.columns[-1]: "outbound_pct"})

# Find the latest year that exists in BOTH datasets
years_inb = set(inb["Year"].dropna().unique())
years_outb = set(outb["Year"].dropna().unique())
common_years = sorted(list(years_inb & years_outb))
latest_common_year = common_years[-1]

# Filter both datasets to that year
inb_y = inb[inb["Year"] == latest_common_year]
outb_y = outb[outb["Year"] == latest_common_year]

# Merge on Code + Year (best key)
merged = pd.merge(inb_y, outb_y, on=["Code", "Year"], suffixes=("_inb", "_outb"))

# Keep one Entity column (country name)
if "Entity_inb" in merged.columns:
    merged["Entity"] = merged["Entity_inb"]
    merged = merged.drop(columns=["Entity_inb", "Entity_outb"])

# Drop rows missing either value
merged = merged.dropna(subset=["inbound_pct", "outbound_pct"])

# Save merged file
out_path = "data/student_mobility_merged.csv"
merged.to_csv(out_path, index=False)

print("Saved:", out_path)
print("Year used:", latest_common_year)
print("Rows:", len(merged))