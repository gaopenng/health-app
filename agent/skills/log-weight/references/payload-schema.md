# Weight payload schema

Pass a payload to `scripts/append-weight-entry.js` with these fields:

- `data_dir`
- `date` in `YYYY-MM-DD`
- `time` in `HH:MM`
- `weight_kg` as a positive number
- `source` such as `manual`, `apple_health`, or `huawei_health`

## Notes

- Normalize natural-language units before invoking the script.
- The script returns the latest prior record and `delta_kg` when available.
