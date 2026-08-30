ELDECO VIVIANA SELECT - FINAL PROJECT

STARTING MAP
Longitude: 75.7925522
Latitude:  30.8497974
Zoom:      14.75

CUSTOM ROAD SYSTEM
Roads ON:
  Shows the normal road overlay.

Roads OFF:
  Hides the normal road overlay.
  Shows only the roads listed in HIGHLIGHTED_ROADS.

CURRENT ROAD
Pakhowal Road
Start: [75.7700, 30.8713291]
End:   [75.7714815, 30.8145833]

ADD ANOTHER ROAD
Open script.js and add another object inside HIGHLIGHTED_ROADS:

{
  name: "Your Road Name",
  color: "#FF6600",
  width: 8,
  coordinates: [
    [START_LONGITUDE, START_LATITUDE],
    [END_LONGITUDE, END_LATITUDE]
  ]
}

IMPORTANT:
Coordinates are [longitude, latitude].
With only a START and END coordinate, the displayed road is a straight line
between those two points. Add more coordinates if you want the line to follow
curves in the real road.
