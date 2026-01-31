# SBS/BaseStation MSG fields (quick ref)

This skill assumes the common SBS/BaseStation CSV format emitted on TCP port **30003**.

We only parse `MSG` lines.

Typical indices (0-based) for `MSG`:
- `0` message type: `MSG`
- `1` transmission type: `1..8`
- `4` ICAO hex (e.g. `406BCA`)
- `10` callsign
- `11` altitude (ft)
- `12` ground speed (kt)
- `13` track (deg)
- `14` latitude
- `15` longitude

Notes:
- Not every message carries lat/lon; position often appears intermittently.
- Callsign may be blank.
