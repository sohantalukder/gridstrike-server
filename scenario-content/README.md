# GridStrike scenario packs

Each directory is an immutable scenario-v2 source. `scenario.json` owns the
world rules, enemy composition, objective, hazards, physics, and visible
modifiers. `maps/` contains Tiled collision/object chunks and `backgrounds/`
contains the opaque environment art loaded by those maps.

Build and validate every pack locally:

```sh
npm run scenarios:build
```

The command writes versioned ZIPs and previews under
`build/scenario-packs/<scenario>/<version>/` and updates the checked-in
catalog manifest with SHA-256 and byte sizes. Packs are rejected above 25 MB
compressed or 80 MB expanded.

To publish, create a public Supabase Storage bucket named
`gridstrike-scenarios`, then provide credentials only through the process
environment:

```sh
SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run scenarios:publish
```

`SCENARIO_ASSET_BUCKET` can override the bucket name. The API should set
`SCENARIO_ASSET_BASE_URL` to the bucket's public object URL. Existing paths are
never overwritten: bump `version` in `scenario.json` before publishing an
update.
