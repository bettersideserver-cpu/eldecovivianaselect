/* ═══════════════════════════════════════════════════════════════════
   PlotBrand.js — pins the animated brand logo to the site-plan outline
   -------------------------------------------------------------------
   The logo is anchored to MAP GEOGRAPHY (so it tracks the plot as the
   map is resized) but drawn at a FIXED PIXEL SIZE (so it stays legible
   on small phones).

   Why JS is needed at all: on desktop the map image is letterboxed
   inside .image-wrapper (image box [0,83,1440,734] vs wrapper
   1440x900), so a plain `top: 60.32%` would resolve against the
   WRAPPER and miss the plot. getImageBox() below resolves percentages
   against the visible IMAGE box instead.

   The box math intentionally mirrors getImageBox()/positionPins() in
   DotPin.js — same offsetWidth/offsetLeft approach, which is
   rotation-proof (getBoundingClientRect returns screen-space
   axis-aligned values and swaps w/h under the mobile 90deg rotation).
   Keep the two in step if either is edited.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    // Right-middle of the "Eldeco Viviana Select" path bbox, as a
    // percentage of the map. Path bbox = x 8.11-18.46%, y 53.22-67.41%.
    // Nudged just outside the right edge so the connector starts clear
    // of the glowing outline instead of on top of it.
    var ANCHOR = { x: 18.9, y: 60.32 };

    var IMAGE_SELECTOR = "#mainImage";
    var BRAND_SELECTOR = ".plot-brand";

    function getImageBox(img, wrapper) {
        var naturalW = img.naturalWidth || Number(img.getAttribute("width")) || 8192;
        var naturalH = img.naturalHeight || Number(img.getAttribute("height")) || 4175;
        var aspect = naturalW / naturalH;

        var imgW = img.offsetWidth || wrapper.clientWidth;
        var imgH = img.offsetHeight || wrapper.clientHeight;

        var visibleW = imgW;
        var visibleH = imgH;

        // contain-style fitting, so coordinates stay attached to the image
        if (imgW / imgH > aspect) {
            visibleH = imgH;
            visibleW = visibleH * aspect;
        } else {
            visibleW = imgW;
            visibleH = visibleW / aspect;
        }

        return {
            left: img.offsetLeft + (imgW - visibleW) / 2,
            top: img.offsetTop + (imgH - visibleH) / 2,
            width: visibleW,
            height: visibleH
        };
    }

    function position() {
        var img = document.querySelector(IMAGE_SELECTOR);
        var brand = document.querySelector(BRAND_SELECTOR);
        if (!img || !brand) return;

        var wrapper = img.closest(".image-wrapper");
        if (!wrapper) return;

        var box = getImageBox(img, wrapper);
        var wrapperW = wrapper.offsetWidth || wrapper.clientWidth || 1;
        var wrapperH = wrapper.offsetHeight || wrapper.clientHeight || 1;

        var xPx = box.left + (ANCHOR.x / 100) * box.width;
        var yPx = box.top + (ANCHOR.y / 100) * box.height;

        brand.style.left = ((xPx / wrapperW) * 100).toFixed(5) + "%";
        brand.style.top = ((yPx / wrapperH) * 100).toFixed(5) + "%";
        brand.classList.add("is-placed");
    }

    function schedule() {
        requestAnimationFrame(function () {
            requestAnimationFrame(position);
        });
    }

    function init() {
        position();
        schedule();

        if (document.querySelector(IMAGE_SELECTOR)) {
            var img = document.querySelector(IMAGE_SELECTOR);
            if (img.complete) schedule();
            else img.addEventListener("load", schedule, { once: true });
        }

        window.addEventListener("resize", position, { passive: true });
        window.addEventListener("orientationchange", schedule, { passive: true });
        window.addEventListener("pageshow", schedule, { passive: true });

        // iOS reports stale metrics right after an orientation flip
        window.addEventListener("orientationchange", function () {
            setTimeout(position, 60);
            setTimeout(position, 320);
        }, { passive: true });

        if (window.ResizeObserver) {
            var wrapper = document.querySelector(".image-wrapper");
            if (wrapper) new ResizeObserver(position).observe(wrapper);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    window.PlotBrand = {
        refresh: position,
        setAnchor: function (x, y) {
            if (Number.isFinite(x)) ANCHOR.x = x;
            if (Number.isFinite(y)) ANCHOR.y = y;
            position();
        }
    };
})();