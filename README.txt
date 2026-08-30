ELDECO VIVIANA SELECT - MAP PROJECT
====================================

Starting map location:
Longitude: 75.7925522
Latitude:  30.8497974
Zoom:      14.75

Main project:
Eldeco Viviana Select

FILES
-----
index.html  - page
script.js   - map + 3D model logic
model.glb   - 3D model
Logo.png    - logo

CUSTOM ROADS
------------
Open script.js and find:

const HIGHLIGHTED_ROADS = [
  // ADD YOUR EXACT ROADS HERE
];

When Roads ON:
- Normal road overlay is visible.

When Roads OFF:
- Normal road overlay is hidden.
- Only roads listed in HIGHLIGHTED_ROADS are displayed.

ROAD FORMAT
-----------
{
  name: "Ferozepur Road",
  color: "#C89A3F",
  width: 6,
  coordinates: [
    [75.7800, 30.8400],
    [75.7900, 30.8450],
    [75.8000, 30.8500]
  ]
}

IMPORTANT:
Coordinates are [LONGITUDE, LATITUDE].
The example above is only a format example; replace it with the
actual coordinates for your selected road.
