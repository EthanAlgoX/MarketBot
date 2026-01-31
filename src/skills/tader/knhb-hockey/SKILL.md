---
name: knhb-hockey
description: Query Dutch field hockey match schedules and results from KNHB Match Center (hockeyweerelt.nl). Use when looking up hockey clubs, teams, upcoming matches, or match results in the Netherlands.
---

# KNHB Hockey Match Center

Query the Dutch Hockey Federation (KNHB) Match Center API for clubs, teams, and matches.

## API Base URL

```
https://publicaties.hockeyweerelt.nl/mc
```

## Endpoints

### List all clubs
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/clubs" | jq '.data[]'
```

Response includes: `id`, `name`, `abbreviation`, `city`, `district.name`, `logo`, `hockey_types[]`

### Search clubs by name or city
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/clubs" | jq '.data[] | select(.name | test("Westland"; "i"))'
curl -s "https://publicaties.hockeyweerelt.nl/mc/clubs" | jq '.data[] | select(.city | test("Delft"; "i"))'
```

### List teams for a club
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/clubs/{clubId}/teams" | jq '.data[]'
```

Response includes: `id`, `name`, `short_name`, `type` (Veld/Zaal), `category_group`, `category_name`, `next_match_date`

### Get upcoming matches for a team
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/teams/{teamId}/matches/upcoming" | jq '.data[]'
```

### Get official (played) matches for a team
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/teams/{teamId}/matches/official" | jq '.data[]'
```

Match response includes:
- `datetime` — ISO 8601 format (UTC)
- `location.city`, `location.street`, `location.description`
- `home_team.name`, `home_team.club_name`
- `away_team.name`, `away_team.club_name`
- `home_score`, `away_score` — null for upcoming matches
- `competition`, `poule`, `status`, `field`

## Common Queries

### Find a club and list its teams
```bash
# Find club ID
CLUB_ID=$(curl -s "https://publicaties.hockeyweerelt.nl/mc/clubs" | jq -r '.data[] | select(.name | test("Westland"; "i")) | .id' | head -1)

# List teams
curl -s "https://publicaties.hockeyweerelt.nl/mc/clubs/${CLUB_ID}/teams" | jq -r '.data[] | "\(.id) \(.name) (\(.type)) - next: \(.next_match_date)"'
```

### Get next match for a specific team
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/teams/{teamId}/matches/upcoming" | jq '.data[0] | {
  date: .datetime,
  home: .home_team.name,
  away: .away_team.name,
  location: .location.city,
  field: .field
}'
```

### Format match schedule nicely
```bash
curl -s "https://publicaties.hockeyweerelt.nl/mc/teams/{teamId}/matches/upcoming" | jq -r '.data[] | "\(.datetime | split("T")[0]) \(.datetime | split("T")[1] | split(".")[0] | .[0:5]) - \(.home_team.name) vs \(.away_team.name) @ \(.location.city)"'
```

## Team Categories

- **Senioren**: Adult teams (H1, D1, etc.)
- **Junioren**: U18-U21
- **Jongste Jeugd**: Youth teams (MO/JO prefixes)
  - MO = Meisjes Onder (Girls Under)
  - JO = Jongens Onder (Boys Under)
  - Example: MO11 = Girls Under 11

## Notes

- **Datetime is in UTC** — add 1 hour for Amsterdam winter time (CET), 2 hours for summer (CEST)
- Use `date` command or proper date library to convert and get correct day of week
- `type: "Veld"` = outdoor field hockey, `type: "Zaal"` = indoor hockey
- **Teams have separate IDs for Veld and Zaal** — always query both to get complete schedule
- Veld season: ~Sep-Jun (outdoor), Zaal season: ~Nov-Mar (indoor)
