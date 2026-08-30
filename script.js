let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let hoveredMesh = null; // 🔥 track hover
let isZooming = false;  // 🔥 prevent spam clicks


// ── URL PARAM ────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const locKey = params.get('location') || 'punjab';

// ── CONFIG ───────────────────────────────────────────────────
const LOCATION_CONFIGS = {

  punjab: {
    center: [75.7925522, 30.8497974],
    zoom: 14,
    projects: [
      {
        name: "Eldeco Viviana Select",
        coords: [75.786169, 30.8300446],
        modelUrl: "model.glb",

        url: "../IPX/index.html",

        transform: {
          position: [0, -100, -50],
          rotation: [Math.PI / 2, 0, 0],
          scale: [350, 350, 350],
          maxZoom: 17
        },

        // ── LOGO CONTROLS ──────────────────────────────────
        logo: {
          image: "Logo.png",
          width: 150,
          speed: 1,
          scale: 1,
          offsetX: 0,
          offsetY: -20,
          bounce: 12,
          opacity: 1
        }
      }
    ]
  },

};

// ── CUSTOM HIGHLIGHTED ROADS ────────────────────────────────
const HIGHLIGHTED_ROADS = [
  {
    name: "200-Feet Road",
    color: "#a2ffa7",
    width: 18,
    zIndex: 10,
    coordinates: [
      [75.7948597, 30.8786881],
      [75.8491632, 30.8574128]
    ]
  },
  {
    name: "Pakhowal Road",
    color: "#4c9aff",
    width: 8,
    zIndex: 5,
    coordinates: [
      [75.8131427, 30.871343],
      [75.7802818, 30.8234162]
    ]
  },
  {
    name: "Lalton-Kheri Road",
    color: "#f94cff",
    width: 7,
    zIndex: 4,
    coordinates: [
      [75.7855562, 30.8339084],
      [75.7885086, 30.8329551]
    ]
  }
];




// ── CUSTOM HIGHLIGHTED ROADS ────────────────────────────────
// Each road is drawn directly from START to END.
// Coordinates are [LONGITUDE, LATITUDE].




async function showHighlightedRoads() {

  if (!map) return;

  clearHighlightedRoads();

  if (!HIGHLIGHTED_ROADS.length) return;

  // Get actual road geometry for every road.
  const routes = await Promise.all(
    HIGHLIGHTED_ROADS.map(async (road) => {
      try {
        const start = road.coordinates[0];
        const end = road.coordinates[road.coordinates.length - 1];
        const route = await getRoute(start, end);

        return {
          ...road,
          geometry: route.geometry
        };
      } catch (error) {
        console.error("Could not create route for:", road.name, error);
        return null;
      }
    })
  );

  const validRoutes = routes.filter(Boolean);
  if (!validRoutes.length) return;

  /*
    IMPORTANT:
    Every road gets its OWN MapLibre source + casing layer + line layer.
    This allows zIndex to control which road is drawn on top at crossings.

    Lower zIndex = drawn first / underneath.
    Higher zIndex = drawn later / on top.
  */
  const orderedRoutes = [...validRoutes].sort(
    (a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0)
  );

  orderedRoutes.forEach((road, index) => {
    const safeId = String(road.name || `road-${index}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const sourceId = `custom-road-${safeId}`;
    const casingId = `custom-road-${safeId}-casing`;
    const lineId = `custom-road-${safeId}-line`;

    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {
          name: road.name,
          color: road.color || "#14804A",
          width: road.width || 8,
          zIndex: Number(road.zIndex) || 0
        },
        geometry: road.geometry
      }
    });

    // Black casing/outline.
    map.addLayer({
      id: casingId,
      type: "line",
      source: sourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      paint: {
        "line-color": "#000000",
        "line-width": (Number(road.width) || 8) + 6,
        "line-opacity": 0.9
      }
    });

    // Actual colored road.
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      paint: {
        "line-color": road.color || "#14804A",
        "line-width": Number(road.width) || 8,
        "line-opacity": 1
      }
    });

    // Name still follows the actual routed road.
    showRoadName(road, road.geometry.coordinates);
  });
}



function clearHighlightedRoads() {

  // Remove all custom road-name labels.
  document.querySelectorAll('[id^="custom-road-name-"]').forEach((label) => {
    if (label._cleanup) label._cleanup();
    label.remove();
  });

  if (!map) return;

  // Remove every individual highlighted-road layer/source.
  HIGHLIGHTED_ROADS.forEach((road, index) => {
    const safeId = String(road.name || `road-${index}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const lineId = `custom-road-${safeId}-line`;
    const casingId = `custom-road-${safeId}-casing`;
    const sourceId = `custom-road-${safeId}`;

    if (map.getLayer(lineId)) map.removeLayer(lineId);
    if (map.getLayer(casingId)) map.removeLayer(casingId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  });

  // Clean up the old shared IDs too, in case an older version created them.
  if (map.getLayer("custom-roads-label")) {
    map.removeLayer("custom-roads-label");
  }

  if (map.getLayer("custom-roads-line")) {
    map.removeLayer("custom-roads-line");
  }

  if (map.getLayer("custom-roads-casing")) {
    map.removeLayer("custom-roads-casing");
  }

  if (map.getSource("custom-roads")) {
    map.removeSource("custom-roads");
  }
}










function showRoadName(road, geometry) {

  // Use the ACTUAL routed road geometry.
  const coords =
    geometry && geometry.length >= 2
      ? geometry
      : road.coordinates;

  if (!coords || coords.length < 2) return;

  // Give every road its own label.
  const safeName = String(road.name || "road")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const labelId = `custom-road-name-${safeName}`;

  // If this exact road label already exists, replace only that label.
  const oldLabel = document.getElementById(labelId);
  if (oldLabel) {
    if (oldLabel._cleanup) oldLabel._cleanup();
    oldLabel.remove();
  }

  // Put the label near the middle of THIS road's actual route.
  const midIndex = Math.floor(coords.length / 2);

  const labelIndexA = Math.max(0, midIndex - 3);
  const labelIndexB = Math.min(coords.length - 1, midIndex + 3);

  const labelPoint = coords[midIndex];
  const directionA = coords[labelIndexA];
  const directionB = coords[labelIndexB];

  const mapContainer = map.getContainer();

  if (getComputedStyle(mapContainer).position === "static") {
    mapContainer.style.position = "relative";
  }

  const label = document.createElement("div");

  label.id = labelId;
  label.textContent = road.name;

  Object.assign(label.style, {
    position: "absolute",
    zIndex: "50",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    color: "#FFFFFF",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1",
    letterSpacing: "0.2px",
    textShadow: `
      -1px -1px 2px #000000,
       1px -1px 2px #000000,
      -1px  1px 2px #000000,
       1px  1px 2px #000000,
       0px  0px 4px #000000
    `,
    transformOrigin: "center center"
  });

  mapContainer.appendChild(label);

  function updateLabel() {

    const pixel = map.project(labelPoint);

    label.style.left = `${pixel.x}px`;
    label.style.top = `${pixel.y}px`;

    // Calculate direction from THIS road's actual geometry.
    const a = map.project(directionA);
    const b = map.project(directionB);

    let angle =
      Math.atan2(
        b.y - a.y,
        b.x - a.x
      ) * 180 / Math.PI;

    // Never show the name upside down.
    if (angle > 90 || angle < -90) {
      angle += 180;
    }

    label.style.transform =
      `translate(-50%, -50%) rotate(${angle}deg)`;
  }

  updateLabel();

  map.on("move", updateLabel);
  map.on("rotate", updateLabel);
  map.on("pitch", updateLabel);
  map.on("resize", updateLabel);

  label._cleanup = () => {
    map.off("move", updateLabel);
    map.off("rotate", updateLabel);
    map.off("pitch", updateLabel);
    map.off("resize", updateLabel);
  };
}



// ── GLOBALS ──────────────────────────────────────────────────
const locConf = LOCATION_CONFIGS[locKey] || LOCATION_CONFIGS.punjab;
const projects = locConf.projects;

let map, scene, camera, renderer, model;
let currentProject = null;

// ── BOUNCING PROJECT LOGO ───────────────────────────────────
// Controls are per-project.
// speed     = bounce cycles per second
// scale     = logo size multiplier
// offsetX   = pixels right (+) / left (-)
// offsetY   = pixels down (+) / up (-)
// bounce    = maximum bounce height in pixels
const PROJECT_LOGO_DEFAULTS = {
  image: "Logo.png",
  width: 150,
  speed: 1.2,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  bounce: 12,
  opacity: 1
};

let projectLogoMarkers = [];
let projectLogoAnimationFrame = null;

// ── INIT ─────────────────────────────────────────────────────
window.onload = () => {

  map = new maplibregl.Map({
    container: 'map',
    // style: {
    //   version: 8,
    //   sources: {

    //     // 🛰 SATELLITE
    //     satellite: {
    //       type: "raster",
    //       tiles: [
    //         "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    //       ],
    //       tileSize: 256
    //     },

    //     // 🛣 ROADS + LABELS
    //     osm: {
    //       type: "vector",
    //       url: "https://demotiles.maplibre.org/tiles/tiles.json"
    //     }

    //   },

    //   layers: [

    //     // 🛰 base
    //     {
    //       id: "satellite",
    //       type: "raster",
    //       source: "satellite"
    //     },
    //     {
    //       id: "road-glow",
    //       type: "line",
    //       source: "osm",
    //       "source-layer": "transportation",
    //       paint: {
    //         "line-color": "#00BFFF",
    //         "line-width": [
    //           "interpolate",
    //           ["linear"],
    //           ["zoom"],
    //           10, 3,
    //           15, 8,
    //           20, 14
    //         ],
    //         "line-opacity": 0.2
    //       }
    //     },
    //     // 🛣 roads
    //     {
    //       id: "roads",
    //       type: "line",
    //       source: "osm",
    //       "source-layer": "transportation",
    //       paint: {
    //         "line-color": "#00BFFF",   // 🔥 bright blue
    //         "line-width": [
    //           "interpolate",
    //           ["linear"],
    //           ["zoom"],
    //           10, 1,
    //           15, 3,
    //           20, 6
    //         ],
    //         "line-opacity": 0.9
    //       }
    //     },

    //     // 🏙 buildings (optional)
    //     {
    //       id: "buildings",
    //       type: "fill",
    //       source: "osm",
    //       "source-layer": "building",
    //       paint: {
    //         "fill-color": "#888",
    //         "fill-opacity": 0.3
    //       }
    //     }

    //   ]
    // },



    style: {
      version: 8,


      sources: {

        // 🛰 Satellite
        satellite: {
          type: "raster",
          tiles: [
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          maxzoom: 18
        },

        // 🛣 Roads overlay (raster labels)
        roads: {
          type: "raster",
          tiles: [
            "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          maxzoom: 17
        }

      },

      layers: [

        // base satellite
        {
          id: "satellite",
          type: "raster",
          source: "satellite"
        },

        // roads overlay
        {
          id: "roads",
          type: "raster",
          source: "roads",
          paint: {
            "raster-opacity": 0
          }
        }

      ]
    },




    center: locConf.center,
    zoom: locConf.zoom,
    maxZoom: 22


  });


  map.getCanvas().addEventListener('click', (event) => {

    if (!model || !currentProject) return;

    const rect = map.getCanvas().getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {

      console.log("Clicked on building 🔥");

      if (currentProject.url) {
        window.open(currentProject.url, "_blank"); // open new tab
      }

    }

  });


  map.addControl(new maplibregl.NavigationControl());


  // Roads are OFF by default on initial page load.
  // Normal road overlay is hidden; custom highlighted roads are shown.
  let roadsVisible = false;

  const roadToggle = document.getElementById("roadToggle");

  if (roadToggle) {
    roadToggle.innerText = "Roads OFF";

    // Apply the initial OFF state immediately.
    // Hide the normal road layer itself so it cannot flash/show before
    // the first style render.
    if (map.getLayer("roads")) {
      map.setLayoutProperty("roads", "visibility", "none");
      map.setPaintProperty("roads", "raster-opacity", 0);
    }

    // Show custom highlighted roads on initial load.
    showHighlightedRoads();

    roadToggle.onclick = () => {
      roadsVisible = !roadsVisible;

      if (roadsVisible) {
        // Normal road overlay ON.
        if (map.getLayer("roads")) {
          map.setLayoutProperty("roads", "visibility", "visible");
          map.setPaintProperty("roads", "raster-opacity", 0.9);
        }

        // Custom road + name OFF.
        clearHighlightedRoads();

        roadToggle.innerText = "Roads ON";
      } else {
        // Normal road overlay OFF.
        if (map.getLayer("roads")) {
          map.setLayoutProperty("roads", "visibility", "none");
          map.setPaintProperty("roads", "raster-opacity", 0);
        }

        // Custom START → END roads ON.
        showHighlightedRoads();

        roadToggle.innerText = "Roads OFF";
      }
    };
  }

  setupProjects();
  setupProjectLogos();
  setupThreeLayer();
  buildPanel();
};


// ── PANEL ────────────────────────────────────────────────────
function buildPanel() {
  const container = document.getElementById('project-buttons');
  container.innerHTML = '';

  projects.forEach((project, i) => {
    const btn = document.createElement('button');
    btn.textContent = project.name;
    btn.onclick = () => focusProject(i);
    container.appendChild(btn);
  });
}


// ── USEFUL PLACES ────────────────────────────────────────────
// Add/edit only this list. Coordinates are [LONGITUDE, LATITUDE].
// The image is anchored directly above the exact coordinate.
const USEFUL_PLACES = [
  {
    name: "Omaxe",
    type: "image",
    image: "useful-places/omaxe.png",
    coordinates: [75.7995844, 30.848248],
    imageWidth: 100,
    imageHeight: 100,
    imageOffsetX: 0,
    imageOffsetY: 0
  },
  {
    name: "Glamton Plaza",
    type: "image",
    image: "useful-places/GlamtonPlaza.png",
    coordinates: [75.7955918, 30.8507624],
    imageWidth: 100,
    imageHeight: 100,
    imageOffsetX: 0,
    imageOffsetY: 0
  },
  {
    name: "Somson",
    type: "image",
    image: "useful-places/Somson.png",
    coordinates: [75.8000082, 30.8552392],
    imageWidth: 100,
    imageHeight: 100,
    imageOffsetX: -20,
    imageOffsetY: 0
  },
  {
    name: "Centra Greens",
    type: "image",
    image: "useful-places/CentraGreens.png",
    coordinates: [75.808498, 30.8671605],
    imageWidth: 100,
    imageHeight: 100,
    imageOffsetX: 0,
    imageOffsetY: 0
  },

  // TEXT EXAMPLE:
  {
    name: "Phullanwal Chowk",
    type: "text",
    coordinates: [75.813092, 30.871354],
    textOffsetX: 0,
    textOffsetY: -20,
    textColor: "#FFFFFF",
    textSize: 16,
    textWeight: "600",
    zIndex: 20,
  },
  {
    name: "Sardar Jewellers",
    type: "text",
    coordinates: [75.8138353, 30.8715642],
    textOffsetX: 0,
    textOffsetY: -20,
    textColor: "#FFFFFF",
    textSize: 16,
    textWeight: "600",
    zIndex: 18,
  }
];

function setupUsefulPlaces() {
  if (!map || !Array.isArray(USEFUL_PLACES)) return;

  document.querySelectorAll(".useful-place-marker").forEach((el) => {
    if (el._usefulMarker) el._usefulMarker.remove();
    else el.remove();
  });

  USEFUL_PLACES.forEach((place, index) => {
    if (!place || !Array.isArray(place.coordinates) || place.coordinates.length !== 2) {
      console.warn("Invalid useful place:", place);
      return;
    }

    const type = place.type || "image";
    const offsetX = Number(type === "text" ? place.textOffsetX : place.imageOffsetX) || 0;
    const offsetY = Number(type === "text" ? place.textOffsetY : place.imageOffsetY) || 0;

    const el = document.createElement("div");
    el.className = "useful-place-marker";

    Object.assign(el.style, {
      position: "relative",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "0",
      pointerEvents: "none",
      overflow: "visible",
      zIndex: "1000"
    });

    // The coordinate dot is the fixed anchor.
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "9px",
      height: "9px",
      transform: "translate(-50%, -50%)",
      borderRadius: "50%",
      background: "#ffffff",
      border: "2px solid #14804A",
      boxSizing: "border-box",
      boxShadow: "0 1px 5px rgba(0,0,0,.6)",
      pointerEvents: "none"
    });

    if (type === "text") {
      const label = document.createElement("div");
      label.textContent = place.name || "Useful Place";

      Object.assign(label.style, {
        position: "absolute",
        left: `${offsetX}px`,
        top: `${offsetY}px`,
        transform: "translate(-50%, -50%)",
        whiteSpace: "nowrap",
        color: place.textColor || "#FFFFFF",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: `${Number(place.textSize) || 16}px`,
        fontWeight: place.textWeight || "600",
        lineHeight: "1",
        textShadow: "-1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 1px 1px 2px #000, 0 0 4px #000",
        pointerEvents: "none",
        userSelect: "none"
      });

      el.appendChild(label);
    } else {
      const imageWidth = Number(place.imageWidth) || 60;
      const imageHeight = Number(place.imageHeight) || 60;

      const image = document.createElement("img");
      image.src = place.image;
      image.alt = place.name || "";
      image.draggable = false;

      Object.assign(image.style, {
        position: "absolute",
        left: `${offsetX}px`,
        top: `${-imageHeight + offsetY}px`,
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        maxWidth: "none",
        maxHeight: "none",
        objectFit: "contain",
        objectPosition: "center bottom",
        display: "block",
        margin: "0",
        padding: "0",
        pointerEvents: "none",
        userSelect: "none",
        transform: "translateX(-50%)",
        transformOrigin: "center bottom",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,.45))"
      });

      image.onerror = () => {
        console.error(`Useful place image ${index + 1} could not be loaded:`, place.image);
        image.style.display = "none";
      };

      el.appendChild(image);
    }

    el.appendChild(dot);

    const marker = new maplibregl.Marker({
      element: el,
      anchor: "bottom"
    }).setLngLat(place.coordinates).addTo(map);

    el._usefulMarker = marker;
  });
}



// ── MARKERS ──────────────────────────────────────────────────
function setupProjects() {
  projects.forEach((project, i) => {

    const el = document.createElement('div');
    el.className = 'marker-wrapper';

    el.innerHTML = `
  <div class="marker-dot"></div>
`;

    new maplibregl.Marker({ element: el })
      .setLngLat(project.coords)
      .addTo(map)
      .getElement()
      .addEventListener('click', () => focusProject(i));
  });
}
function setupProjectLogos() {
  if (!map) return;

  // Remove previous logo markers if this function is called again.
  projectLogoMarkers.forEach(({ marker }) => marker.remove());
  projectLogoMarkers = [];

  projects.forEach((project, index) => {
    if (!project || !Array.isArray(project.coords)) return;

    const settings = {
      ...PROJECT_LOGO_DEFAULTS,
      ...(project.logo || {})
    };

    const root = document.createElement("div");
    root.className = "project-logo-marker";

    Object.assign(root.style, {
      position: "relative",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "0",
      pointerEvents: "none",
      overflow: "visible",
      zIndex: "1100"
    });

    const img = document.createElement("img");
    img.src = settings.image || PROJECT_LOGO_DEFAULTS.image;
    img.alt = `${project.name || "Project"} logo`;
    img.draggable = false;

    Object.assign(img.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${Number(settings.width) || PROJECT_LOGO_DEFAULTS.width}px`,
      height: "auto",
      maxWidth: "none",
      maxHeight: "none",
      display: "block",
      margin: "0",
      padding: "0",
      pointerEvents: "none",
      userSelect: "none",
      transformOrigin: "center bottom",
      transform: "translateX(-50%)",
      opacity: String(settings.opacity ?? 1),
      filter: "drop-shadow(0 3px 6px rgba(0,0,0,.45))",
      willChange: "transform, top"
    });

    root.appendChild(img);

    const marker = new maplibregl.Marker({
      element: root,
      anchor: "bottom"
    })
      .setLngLat(project.coords)
      .addTo(map);

    projectLogoMarkers.push({
      marker,
      root,
      img,
      settings,
      index,
      phase: index * 0.35,
      hidden: false
    });
  });

  if (!projectLogoAnimationFrame) {
    const animateProjectLogos = (time) => {
      projectLogoMarkers.forEach((item) => {
        if (item.hidden) return;

        const speed = Math.max(0, Number(item.settings.speed) || 0);
        const scale = Math.max(0.01, Number(item.settings.scale) || 1);
        const bounce = Math.max(0, Number(item.settings.bounce) || 0);
        const offsetX = Number(item.settings.offsetX) || 0;
        const offsetY = Number(item.settings.offsetY) || 0;

        // Smooth up/down motion. At 0 speed the logo stays still.
        const wave = speed > 0
          ? (Math.sin((time / 1000) * Math.PI * 2 * speed + item.phase) + 1) / 2
          : 0;

        const lift = wave * bounce;

        item.img.style.left = `${offsetX}px`;
        item.img.style.top = `${-item.img.offsetHeight + offsetY - lift}px`;
        item.img.style.transform = `translateX(-50%) scale(${scale})`;
      });

      projectLogoAnimationFrame = requestAnimationFrame(animateProjectLogos);
    };

    projectLogoAnimationFrame = requestAnimationFrame(animateProjectLogos);
  }
}


function showNearbyRoad(project) {

  const coords = project.coords;

  // remove old
  if (map.getLayer('road-label')) {
    map.removeLayer('road-label');
    map.removeSource('road-label');
  }

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: coords
        },
        properties: {
          name: project.roadName || "Nearby Road"
        }
      }
    ]
  };

  map.addSource('road-label', {
    type: 'geojson',
    data: geojson
  });

  // 📝 ONLY TEXT
  map.addLayer({
    id: 'road-label',
    type: 'symbol',
    source: 'road-label',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 14,
      'text-offset': [0, -2],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000',
      'text-halo-width': 2
    }
  });
}
// ── CAMERA SETTINGS: DESKTOP / PHONE ─────────────────────────
// Change ONLY these values to control the camera separately.
//
// Desktop: screens wider than 768px
// Phone:   screens 768px and narrower
const CAMERA_SETTINGS = {
  desktop: {
    pitch: 0,
    bearing: 180
  },

  phone: {
    pitch: 0,
    bearing: 180
  }
};

function getCameraSettings() {
  return window.innerWidth <= 768
    ? CAMERA_SETTINGS.phone
    : CAMERA_SETTINGS.desktop;
}

// ── CAMERA MOVE ──────────────────────────────────────────────
function hideProjectLogo(index) {
  const item = projectLogoMarkers.find((logo) => logo.index === index);
  if (!item) return;

  item.hidden = true;
  item.root.style.display = "none";
}

function showProjectLogos() {
  projectLogoMarkers.forEach((item) => {
    item.hidden = false;
    item.root.style.display = "block";
  });
}

function focusProject(index) {
  // Hide the bouncing logo as soon as this project point is clicked.
  hideProjectLogo(index);


  const project = projects[index];
  currentProject = project;

  const projectMaxZoom =
    project.maxZoom ||
    project.transform?.maxZoom ||
    22;

  map.setMaxZoom(projectMaxZoom);

  const cameraSettings = getCameraSettings();

  map.flyTo({
    center: project.coords,
    zoom: project.zoom || 17,
    pitch: cameraSettings.pitch,
    bearing: cameraSettings.bearing
  });

  loadModel(project);

  document.getElementById("nearbyPanel").style.display = "block";

  showNearbyRoad(project);
  // remove active from all
  document.querySelectorAll(".marker-wrapper")
    .forEach(m => m.classList.remove("active"));

  // activate current marker
  const markerEl = document.querySelectorAll(".marker-wrapper")[index];
  markerEl.classList.add("active");

  // button inside marker
  const btn = markerEl.querySelector(".explore-btn");

  btn.onclick = (e) => {
    e.stopPropagation(); // 🔥 VERY IMPORTANT
    window.location.href = project.url;
  };
}
function drawInfoLine(start, end, text) {

  // remove old
  if (map.getLayer('info-line')) {
    map.removeLayer('info-line');
    map.removeSource('info-line');
  }
  if (map.getLayer('info-text')) {
    map.removeLayer('info-text');
  }

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [start, end]
        }
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            (start[0] + end[0]) / 2,
            (start[1] + end[1]) / 2
          ]
        },
        properties: {
          title: text
        }
      }
    ]
  };

  map.addSource('info-line', {
    type: 'geojson',
    data: geojson
  });

  // 🔵 line
  map.addLayer({
    id: 'info-line',
    type: 'line',
    source: 'info-line',
    paint: {
      'line-color': '#14804A',
      'line-width': 4
    }
  });

  // 📝 text label
  map.addLayer({
    id: 'info-text',
    type: 'symbol',
    source: 'info-line',
    layout: {
      'text-field': ['get', 'title'],
      'text-size': 14,
      'text-offset': [0, -1],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 2
    }
  });
}
// ── THREE LAYER ──────────────────────────────────────────────
function setupThreeLayer() {

  map.on('load', () => {

    const customLayer = {

      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',

      onAdd(map, gl) {

        camera = new THREE.Camera();
        scene = new THREE.Scene();

        // 🌤 Ambient (soft base light)
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        // ☀️ Hemisphere (fake global illumination)
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
        scene.add(hemi);

        // 🌞 Directional (sun light)
        const dir = new THREE.DirectionalLight(0xffffff, 2);
        dir.position.set(100, 200, 100);
        scene.add(dir);



        const texLoader = new THREE.TextureLoader();

        texLoader.load(
          'https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg',
          (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;

            scene.environment = texture; // 🔥 reflections + GI feel
          }
        );



        renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        renderer.physicallyCorrectLights = true;
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.autoClear = false;
      },

      render(gl, matrix) {

        if (!model || !currentProject) return;

        const mercator = maplibregl.MercatorCoordinate.fromLngLat(
          currentProject.coords,
          50
        );

        const scale = mercator.meterInMercatorCoordinateUnits();

        const m = new THREE.Matrix4().fromArray(matrix);

        const t = currentProject.transform || {};
        const pos = t.position || [0, 0, 0];

        const transform = new THREE.Matrix4()
          .makeTranslation(
            mercator.x + pos[0] * scale,
            mercator.y + pos[1] * scale,
            mercator.z + pos[2] * scale
          )
          .scale(new THREE.Vector3(scale, -scale, scale));

        camera.projectionMatrix = m.multiply(transform);

        renderer.resetState();
        renderer.render(scene, camera);
        map.triggerRepaint();
      }
    };

    map.addLayer(customLayer);

    setupUsefulPlaces();
  });
}

// ── MODEL LOADER ─────────────────────────────────────────────
function loadModel(project) {

  const loader = new THREE.GLTFLoader();

  if (model) scene.remove(model);

  loader.load(project.modelUrl, (gltf) => {

    model = gltf.scene;

    const t = project.transform || {};

    model.rotation.set(...(t.rotation || [0, 0, 0]));
    model.scale.set(...(t.scale || [1, 1, 1]));

    // ✅ FIXED traverse
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMapIntensity = 1.5;
      }
    });

    scene.add(model);

    console.log("Loaded:", project.name);
  });
}






// ── ROUTING ───────────────────────────────────────────────────
// ── MAPBOX TOKEN ─────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoiYW1hbnBhbmVzYXIiLCJhIjoiY21ud3VwNHo0MDBjNDJxczh6a3c4Y2RlaSJ9.JGJ94Fyek4zBUNwZNAxxsw";

// ── GEOCODING ────────────────────────────────────────────────
async function getCoordinates(place) {

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${place}.json?access_token=${MAPBOX_TOKEN}`
  );

  const data = await res.json();

  if (!data.features.length) {
    alert("Location not found");
    return null;
  }

  return data.features[0].center;
}

// ── ROUTE ────────────────────────────────────────────────────
async function getRoute(start, end) {

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();

  const route = data.routes[0];

  return {
    geometry: route.geometry,
    distance: (route.distance / 1000).toFixed(2),
    duration: (route.duration / 60).toFixed(1)
  };
}

// ── DRAW ROUTE ───────────────────────────────────────────────
function drawRoute(geometry, distance, duration, start, end) {

  if (map.getLayer('route')) {
    map.removeLayer('route');
    map.removeSource('route');
  }

  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: geometry
    }
  });

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {
      'line-color': '#14804A',
      'line-width': 5,
      'line-opacity': 0.9
    }
  });

  // 🔥 Fit full route nicely
  map.fitBounds([start, end], {
    padding: 100,
    pitch: 60
  });

  // 🔥 Clean UI instead of alert
  let info = document.getElementById("route-info");

  if (!info) {
    info = document.createElement("div");
    info.id = "route-info";
    info.style = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      z-index: 1000;
    `;
    document.body.appendChild(info);
  }

  info.innerHTML = `Distance: ${distance} km<br>Time: ${duration} min`;
}

// ── SEARCH EVENT ─────────────────────────────────────────────
document.getElementById("searchBox").addEventListener("keypress", async (e) => {

  if (e.key === "Enter") {

    if (!currentProject) {
      alert("Select a project first");
      return;
    }

    const place = e.target.value;

    const start = await getCoordinates(place);
    if (!start) return;

    const end = currentProject.coords;

    const route = await getRoute(start, end);

    drawRoute(route.geometry, route.distance, route.duration, start, end);
  }
});


//Auto Search
// async function getSuggestions(query) {

//   if (!query) return [];

//   const center = map.getCenter();

//   const res = await fetch(
//     `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?autocomplete=true&limit=5&country=in&proximity=${center.lng},${center.lat}&access_token=${MAPBOX_TOKEN}`
//   );

//   const data = await res.json();

//   return data.features;
// }




// 🔥 Using Google Places API for better suggestions and more local results
async function getSuggestions(query) {

  return new Promise((resolve) => {

    const service =
      new google.maps.places.AutocompleteService();

    service.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: "in" }
      },
      (predictions, status) => {

        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          resolve([]);
          return;
        }

        resolve(predictions);
      }
    );

  });
}









// function showSuggestions(list) {

//   const box = document.getElementById("suggestions");

//   box.innerHTML = "";

//   if (!list.length) {
//     box.style.display = "none";
//     return;
//   }

//   list.forEach(item => {

//     const div = document.createElement("div");

//     div.innerText = item.place_name;
//     div.style.padding = "10px";
//     div.style.cursor = "pointer";
//     div.style.borderBottom = "1px solid rgba(255,255,255,0.1)";

//     div.onmouseover = () => div.style.background = "rgba(255,255,255,0.1)";
//     div.onmouseout = () => div.style.background = "transparent";

//     div.onclick = async () => {

//       document.getElementById("searchBox").value = item.place_name;
//       box.style.display = "none";

//       if (!currentProject) {
//         alert("Select a project first");
//         return;
//       }

//       const start = item.center;
//       const end = currentProject.coords;

//       const route = await getRoute(start, end);

//       drawRoute(route.geometry, route.distance, route.duration, start, end);
//     };

//     box.appendChild(div);
//   });

//   box.style.display = "block";
// }




// 🔥 get coordinates from Google Geocoding API (since we switched to Google Places for suggestions)
async function getGoogleCoordinates(place) {

  return new Promise((resolve) => {

    const geocoder =
      new google.maps.Geocoder();

    geocoder.geocode(
      { address: place },
      (results, status) => {

        if (status === "OK") {

          const loc =
            results[0].geometry.location;

          resolve([
            loc.lng(),
            loc.lat()
          ]);

        } else {
          resolve(null);
        }
      }
    );

  });
}









// 🔥 Updated to work with Google Places API response
function showSuggestions(list) {

  const box = document.getElementById("suggestions");
  box.innerHTML = "";

  if (!list.length) {
    box.style.display = "none";
    return;
  }

  list.forEach(item => {

    const div = document.createElement("div");

    div.innerText = item.description;
    div.style.padding = "10px";
    div.style.cursor = "pointer";
    div.style.borderBottom =
      "1px solid rgba(255,255,255,0.1)";

    div.onmouseover = () =>
      div.style.background =
      "rgba(255,255,255,0.1)";

    div.onmouseout = () =>
      div.style.background = "transparent";

    div.onclick = async () => {

      document.getElementById("searchBox").value =
        item.description;

      box.style.display = "none";

      const coords =
        await getGoogleCoordinates(item.description);

      if (!coords || !currentProject) return;

      const route =
        await getRoute(coords, currentProject.coords);

      drawRoute(
        route.geometry,
        route.distance,
        route.duration,
        coords,
        currentProject.coords
      );
    };

    box.appendChild(div);
  });

  box.style.display = "block";
}







const searchBox = document.getElementById("searchBox");

searchBox.addEventListener("input", async () => {

  const query = searchBox.value;

  if (query.length < 3) {
    document.getElementById("suggestions").style.display = "none";
    return;
  }

  const suggestions = await getSuggestions(query);

  showSuggestions(suggestions);
});









// ── NEARBY PLACES ─────────────────────────────────────────────
let nearbyMarkers = [];
let currentCategory = "hospital";

// 🔥 calculate distance between two lat/lng points in KM
function getDistanceKm(lat1, lon1, lat2, lon2) {

  const R = 6371;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}


// async function searchNearby(type) {

//   if (!currentProject) return;

//   currentCategory = type;

//   clearNearbyMarkers();

//   const radiusKm =
//     parseInt(document.getElementById("radiusSlider").value);

//   const service =
//     new google.maps.places.PlacesService(
//       document.createElement("div")
//     );

//   const location =
//     new google.maps.LatLng(
//       currentProject.coords[1],
//       currentProject.coords[0]
//     );
// // 🔥 Google Places API expects radius in meters
//   let request = {
//     location: location,
//     radius: radiusKm * 1000
//   };

//   if (type === "airport") {
//     request.type = "airport";
//   }
//   else if (type === "hospital") {
//     request.type = "hospital";
//   }
//   else if (type === "school") {
//     request.type = "school";
//   }
//   else if (type === "mall") {
//     request.keyword = "shopping mall";
//   }
//   else {
//     request.keyword = type;
//   }

//   service.nearbySearch(request, (results, status) => {

//     if (status !== google.maps.places.PlacesServiceStatus.OK) {
//       alert("No nearby " + type + " found");
//       return;
//     }

//     let bounds = new maplibregl.LngLatBounds();
//     bounds.extend(currentProject.coords);

//     results.forEach(place => {

//       const lat = place.geometry.location.lat();
//       const lng = place.geometry.location.lng();

//       const marker = new maplibregl.Marker({
//         color: "#14804A"
//       })
//         .setLngLat([lng, lat])
//         .setPopup(
//           new maplibregl.Popup().setHTML(
//             `<b>${place.name}</b><br>${place.vicinity}`
//           )
//         )
//         .addTo(map);

//       nearbyMarkers.push(marker);

//       bounds.extend([lng, lat]);
//     });

//     map.fitBounds(bounds, {
//       padding: 100,
//       pitch: 55,
//       duration: 1500
//     });

//   });
// }

// 🔥 CLEAR FILTER
function clearFilter() {

  // remove nearby markers
  clearNearbyMarkers();

  // reset selected category
  currentCategory = "";

  // remove active button highlight
  document.querySelectorAll(".filter-btn")
    .forEach(btn => btn.classList.remove("active"));

  // hide cross button
  document.getElementById("clearFilterBtn").style.display = "none";

  // go back to selected project
  if (currentProject) {
    const cameraSettings = getCameraSettings();

    map.flyTo({
      center: currentProject.coords,
      zoom: currentProject.zoom || 17,
      pitch: cameraSettings.pitch,
      bearing: cameraSettings.bearing,
      duration: 1500
    });
  }
}

// Improved search logic with better radius handling and stricter airport filtering
async function searchNearby(type, btn) {

  if (!currentProject) return;

  currentCategory = type;

  clearNearbyMarkers();

  // remove old active state
  document.querySelectorAll(".filter-btn")
    .forEach(b => b.classList.remove("active"));

  // highlight clicked button
  if (btn) btn.classList.add("active");

  // show clear button
  document.getElementById("clearFilterBtn").style.display = "inline-block";

  const service =
    new google.maps.places.PlacesService(
      document.createElement("div")
    );

  const location =
    new google.maps.LatLng(
      currentProject.coords[1],
      currentProject.coords[0]
    );

  // fixed radius in meters
  let radius = 50000;

  if (type === "school") radius = 15000;
  if (type === "airport") radius = 20000;
  if (type === "mall") radius = 20000;
  if (type === "hospital") radius = 20000;

  let request = {
    location: location,
    radius: radius
  };

  // search rules
  if (type === "airport") {
    request.keyword = "international airport airport terminal";
  }
  else if (type === "hospital") {
    request.type = "hospital";
  }
  else if (type === "school") {
    request.type = "school";
  }
  else if (type === "mall") {
    request.keyword = "shopping mall";
  }

  service.nearbySearch(request, (results, status) => {

    if (
      status !== google.maps.places.PlacesServiceStatus.OK ||
      !results ||
      !results.length
    ) {
      alert("No nearby " + type + " found");
      return;
    }

    let bounds = new maplibregl.LngLatBounds();
    bounds.extend(currentProject.coords);

    results.forEach(place => {

      // airport cleanup
      if (type === "airport") {

        const name = place.name.toLowerCase();

        if (
          name.includes("taxi") ||
          name.includes("cab") ||
          name.includes("travel") ||
          name.includes("driver") ||
          name.includes("hotel")
        ) {
          return;
        }
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      const marker = new maplibregl.Marker({
        color: "#14804A"
      })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<b>${place.name}</b><br>${place.vicinity || ""}`
          )
        )
        .addTo(map);

      nearbyMarkers.push(marker);

      bounds.extend([lng, lat]);
    });

    map.fitBounds(bounds, {
      padding: 100,
      pitch: 55,
      duration: 1500
    });

  });
}











// 🔥 called on category change and radius change
function changeRadius() {
  searchNearby(currentCategory);
}
// 🔥 remove old nearby markers
function clearNearbyMarkers() {
  nearbyMarkers.forEach(m => m.remove());
  nearbyMarkers = [];
}


// 🔥 called on radius slider change
function updateRadius() {
  const val = document.getElementById("radiusSlider").value;
  document.getElementById("radiusValue").innerText = val;

  searchNearby(currentCategory);
}