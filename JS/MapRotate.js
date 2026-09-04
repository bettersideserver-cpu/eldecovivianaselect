// JS/MapRotate.js
// ================================================================
// Companion to JS/CSS/Map-Rotate.css
//
// Job 1: keep --vw / --vh in sync with the REAL viewport.
//        On mobile, 100vh is the wrong number — it includes the area
//        behind the browser's collapsing address bar, so a vh-sized
//        rotated frame gets clipped. window.innerHeight (or
//        visualViewport.height) is the honest value.
//
// Job 2: after the frame resizes, tell DotPin.js to re-measure.
//        DotPin already listens for `resize`, so one synthetic event
//        re-anchors every pin to the image.
// ================================================================
(function () {
    "use strict";

    var root = document.documentElement;

    function syncViewportVars() {
        var vv = window.visualViewport;
        var w = Math.round((vv && vv.width) || window.innerWidth || root.clientWidth);
        var h = Math.round((vv && vv.height) || window.innerHeight || root.clientHeight);

        root.style.setProperty("--vw", w + "px");
        root.style.setProperty("--vh", h + "px");
    }

    // Is the map currently rotated? Handy for other scripts / debugging.
    function isRotated() {
        return window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
    }

    function refresh() {
        syncViewportVars();
        root.classList.toggle("map-is-rotated", isRotated());

        // Let DotPin.js re-measure against the new frame size.
        // rAF x2 so the browser has finished laying the frame out first.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                window.dispatchEvent(new Event("resize"));
            });
        });
    }

    syncViewportVars();
    root.classList.toggle("map-is-rotated", isRotated());

    window.addEventListener("resize", syncViewportVars, { passive: true });

    window.addEventListener("orientationchange", function () {
        // iOS reports stale dimensions immediately after the event.
        setTimeout(refresh, 60);
        setTimeout(refresh, 320);
    }, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", syncViewportVars, { passive: true });
    }

    // Re-run once the map image has decoded (natural size drives the pin math).
    var img = document.getElementById("mainImage");
    if (img) {
        if (img.complete) refresh();
        else img.addEventListener("load", refresh, { once: true });
    }

    window.addEventListener("pageshow", refresh);

    // Expose for manual use, e.g. MapRotate.setAngle(-90)
    window.MapRotate = {
        isRotated: isRotated,
        refresh: refresh,
        setAngle: function (deg) {
            root.style.setProperty("--map-rotate", deg + "deg");
            refresh();
        }
    };
})();