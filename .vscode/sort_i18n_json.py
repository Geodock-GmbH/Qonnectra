import json
import glob

for path in glob.glob("frontend/messages/*.json"):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    sorted_data = dict(sorted(data.items(), key=lambda x: (x[0] != "$schema", x[0])))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent="\t")
        f.write("\n")
    print(f"Sorted {path}")
