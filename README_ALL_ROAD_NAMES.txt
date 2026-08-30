ALL CUSTOM ROAD NAMES FIX

Every custom road now gets its own independent label.

Current roads:
- 200-Feet Road
- Pakhowal Road

The previous problem was that every call to showRoadName() removed the
previous label using the same id "custom-road-name". Therefore only the
last road name remained visible.

This version gives every road a unique label id and cleans up all labels
when custom roads are hidden.
