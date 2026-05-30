// ─────────────────────────────────────────────────────────────────────────────
// Nərimanov Monitoring Pro — Custom Mapbox GL JS style
//
// Edit the color palette below to change the entire map theme instantly.
// No Mapbox Studio needed — the style is defined fully in code.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  // ── Base ──────────────────────────────────────────────────────────────────
  land:          "#0d1b2e",   // background / land fill
  water:         "#071428",   // water bodies
  waterway:      "#0a1832",   // rivers & streams

  // ── Green spaces ──────────────────────────────────────────────────────────
  park:          "#0a1c10",   // parks, grass, woodland

  // ── Roads ─────────────────────────────────────────────────────────────────
  roadCasing:    "#060f1e",   // road outline / casing
  roadMajor:     "#1e3a5f",   // motorway / trunk / primary
  roadSecondary: "#152d4a",   // secondary / tertiary
  roadStreet:    "#111f33",   // local streets

  // ── Buildings ─────────────────────────────────────────────────────────────
  buildingFill:  "#101c2d",   // building footprint
  buildingBase:  "#152438",   // extrusion base colour
  buildingTop:   "#1e3252",   // extrusion top / roof colour (taller = lighter)

  // ── Labels ────────────────────────────────────────────────────────────────
  textCity:      "rgba(210,228,255,0.90)",   // city / town names
  textNeighbor:  "rgba(180,210,255,0.60)",   // neighbourhood / suburb
  textRoad:      "#c8deff",   // road name labels
  textHalo:      "#07101e",                  // halo behind all text

  // ── Admin / borders ───────────────────────────────────────────────────────
  adminLine:     "#1a2d45",
};

// ─────────────────────────────────────────────────────────────────────────────
// The full style specification
// Source: mapbox.mapbox-streets-v8  (works with any valid Mapbox token)
// ─────────────────────────────────────────────────────────────────────────────
export const narimanovMonitoringStyle = {
  version: 8,
  name: "Nərimanov Monitoring Pro",
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}",
  sprite: "mapbox://sprites/mapbox/streets-v12",
  sources: {
    streets: {
      type: "vector",
      url: "mapbox://mapbox.mapbox-streets-v8",
    },
  },
  layers: [

    // ── Background (land) ───────────────────────────────────────────────────
    {
      id: "background",
      type: "background",
      paint: { "background-color": C.land },
    },

    // ── Water ───────────────────────────────────────────────────────────────
    {
      id: "water",
      type: "fill",
      source: "streets",
      "source-layer": "water",
      paint: { "fill-color": C.water },
    },
    {
      id: "waterway",
      type: "line",
      source: "streets",
      "source-layer": "waterway",
      paint: { "line-color": C.waterway, "line-width": 1, "line-opacity": 0.7 },
    },

    // ── Landuse ─────────────────────────────────────────────────────────────
    {
      id: "landuse-green",
      type: "fill",
      source: "streets",
      "source-layer": "landuse",
      filter: ["match", ["get", "class"], ["park", "grass", "scrub", "wood", "pitch", "golf"], true, false],
      paint: { "fill-color": C.park, "fill-opacity": 0.9 },
    },

    // ── Road casings (drawn first so fill sits on top) ───────────────────────
    {
      id: "road-motorway-casing",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"], ["motorway", "motorway_link"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.roadCasing,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 18, 14],
      },
    },
    {
      id: "road-primary-casing",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"], ["trunk", "primary"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.roadCasing,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 18, 10],
      },
    },

    // ── Roads ───────────────────────────────────────────────────────────────
    {
      id: "road-motorway",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"], ["motorway", "motorway_link"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.roadMajor,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 18, 10],
      },
    },
    {
      id: "road-trunk-primary",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"], ["trunk", "primary", "trunk_link", "primary_link"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.roadMajor,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 18, 7],
      },
    },
    {
      id: "road-secondary",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"], ["secondary", "tertiary", "secondary_link", "tertiary_link"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.roadSecondary,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 18, 5],
      },
    },
    {
      id: "road-street",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"], ["street", "street_limited", "service", "track"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.roadStreet,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 18, 3],
      },
    },

    // ── Buildings — footprint ────────────────────────────────────────────────
    {
      id: "building-fill",
      type: "fill",
      source: "streets",
      "source-layer": "building",
      minzoom: 12,   // was 14 — show footprints earlier as you zoom out
      paint: {
        "fill-color": C.buildingFill,
        // Fade in smoothly as you zoom in, so buildings don't pop
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.3, 14, 0.85],
      },
    },

    // ── Buildings — 3D extrusion ─────────────────────────────────────────────
    {
      id: "3d-buildings",
      type: "fill-extrusion",
      source: "streets",
      "source-layer": "building",
      filter: ["==", ["get", "extrude"], "true"],
      minzoom: 12,   // was 14 — render 3D from further out
      paint: {
        "fill-extrusion-color": [
          "interpolate", ["linear"], ["get", "height"],
          0,   C.buildingBase,
          50,  C.buildingTop,
          200, "#243d5e",
        ],
        "fill-extrusion-height":  ["get", "height"],
        "fill-extrusion-base":    ["get", "min_height"],
        // Fade in as you zoom in — at zoom 12 very subtle, full at zoom 14+
        "fill-extrusion-opacity": [
          "interpolate", ["linear"], ["zoom"],
          12, 0.15,
          13, 0.45,
          14, 0.65,
        ],
      },
    },

    // ── Road labels — major roads (motorway → secondary) ────────────────────
    // text-pitch-alignment: viewport keeps labels readable at 45° pitch
    {
      id: "road-label",
      type: "symbol",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"],
        ["motorway", "motorway_link", "trunk", "trunk_link",
         "primary", "primary_link", "secondary", "secondary_link"], true, false],
      minzoom: 10,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ["get", "name_en"]],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 16, 15],
        "symbol-placement": "line",
        "text-pitch-alignment": "viewport",
        "text-rotation-alignment": "map",
        "text-max-angle": 30,
        "text-padding": 6,
        "text-max-width": 12,
      },
      paint: {
        "text-color": "#dce8ff",
        "text-halo-color": "#06090f",
        "text-halo-width": 2,
      },
    },

    // ── Road labels — local streets (tertiary → service) ────────────────────
    {
      id: "road-label-minor",
      type: "symbol",
      source: "streets",
      "source-layer": "road",
      filter: ["match", ["get", "class"],
        ["tertiary", "tertiary_link", "street", "street_limited", "service"], true, false],
      minzoom: 13,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ["get", "name_en"]],
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 18, 13],
        "symbol-placement": "line",
        "text-pitch-alignment": "viewport",
        "text-rotation-alignment": "map",
        "text-max-angle": 30,
        "text-padding": 6,
        "text-max-width": 10,
      },
      paint: {
        "text-color": "#c8deff",
        "text-halo-color": "#06090f",
        "text-halo-width": 2,
      },
    },

    // ── Neighbourhood / suburb labels ────────────────────────────────────────
    {
      id: "label-neighborhood",
      type: "symbol",
      source: "streets",
      "source-layer": "place_label",
      filter: ["match", ["get", "class"], ["suburb", "quarter", "neighborhood"], true, false],
      minzoom: 11,
      layout: {
        "text-field": ["coalesce", ["get", "name_az"], ["get", "name_en"], ["get", "name"]],
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 14],
        "text-max-width": 8,
        "text-letter-spacing": 0.05,
      },
      paint: {
        "text-color": C.textNeighbor,
        "text-halo-color": C.textHalo,
        "text-halo-width": 1.5,
      },
    },

    // ── City / town labels ───────────────────────────────────────────────────
    {
      id: "label-city",
      type: "symbol",
      source: "streets",
      "source-layer": "place_label",
      filter: ["match", ["get", "class"], ["city", "town", "village"], true, false],
      layout: {
        "text-field": ["coalesce", ["get", "name_az"], ["get", "name_en"], ["get", "name"]],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 13, 16, 22],
        "text-max-width": 10,
      },
      paint: {
        "text-color": C.textCity,
        "text-halo-color": C.textHalo,
        "text-halo-width": 2,
      },
    },

    // ── Admin boundaries ─────────────────────────────────────────────────────
    {
      id: "admin-boundary",
      type: "line",
      source: "streets",
      "source-layer": "admin",
      filter: ["<=", ["get", "admin_level"], 4],
      paint: {
        "line-color": C.adminLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 10, 1.5],
        "line-opacity": 0.6,
        "line-dasharray": [2, 2],
      },
    },

  ],
} as const;
