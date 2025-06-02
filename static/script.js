// static/script.js

$(document).ready(function () {
  // ─── Loader captions to cycle through ─────────────────────────────────────
  // Provide several fun loader messages that rotate during the Gemini API call :contentReference[oaicite:3]{index=3}
  const captions = [
    "Crafting prompt… ✍️",
    "AI is in artistic mode… 🎨",
    "Generating palettes… 🌈",
    "Converting codes to colors… 💻✨",
    "Almost there… Nearly done! 💪"
  ];
  let captionIndex = 0;
  let captionInterval = null;

  // ─── Tag-pill click: toggle .active, update hidden tags input ─────────────
  // When a user clicks a tag, toggle its active class and update the hidden input :contentReference[oaicite:4]{index=4}
  $(".tag-pill").on("click", function () {
    $(this).toggleClass("active");
    const activeTags = $(".tag-pill.active")
      .map(function () {
        return $(this).data("value");
      })
      .get();
    $("#tags_input").val(activeTags.join(","));
  });

  // ─── Cycle loader captions every 1.5 seconds ─────────────────────────────
  // Switch the loader message periodically while waiting for the backend :contentReference[oaicite:5]{index=5}
  function cycleCaptions() {
    $("#loader-caption").text(captions[captionIndex]);
    captionIndex = (captionIndex + 1) % captions.length;
  }

  // ─── Convert hex string (e.g., "#FF5733") → {r, g, b} ────────────────────
  // Remove leading “#” and parse the integer value :contentReference[oaicite:6]{index=6}
  function hexToRgb(hex) {
    const cleanHex = hex.replace("#", "");
    const bigint = parseInt(cleanHex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  // ─── Convert hex → CSS “rgb(r, g, b)” string ───────────────────────────
  // Use the helper above to build a string suitable for CSS backgrounds :contentReference[oaicite:7]{index=7}
  function hexToRgbString(hex) {
    const { r, g, b } = hexToRgb(hex);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // ─── Convert {r, g, b} → “cmyk(C%, M%, Y%, K%)” ──────────────────────────
  // Standard formula for RGB → CMYK conversion; k = 1 – max(r', g', b') :contentReference[oaicite:8]{index=8}
  function rgbToCmykString({ r, g, b }) {
    const r1 = r / 255;
    const g1 = g / 255;
    const b1 = b / 255;
    const k = 1 - Math.max(r1, g1, b1);
    const c = (1 - r1 - k) / (1 - k) || 0;
    const m = (1 - g1 - k) / (1 - k) || 0;
    const y = (1 - b1 - k) / (1 - k) || 0;
    return `cmyk(${(c * 100).toFixed(0)}%, ${(m * 100).toFixed(0)}%, ${(y * 100).toFixed(0)}%, ${(k * 100).toFixed(0)}%)`;
  }

  // ─── Open Bootstrap modal, populate circles + codes ───────────────────────────
  // Build one circle+labels per valid hex in the palette array :contentReference[oaicite:9]{index=9}
  function openPaletteModal(palette) {
    const circlesContainer = $("#modal-color-circles");
    const codesContainer = $("#modal-codes");
    circlesContainer.empty();
    codesContainer.empty();

    // Filter out any falsy entries (null/undefined/””) to avoid blank blocks :contentReference[oaicite:10]{index=10}
    const validColors = palette.filter((hex) => typeof hex === "string" && hex.startsWith("#"));

    validColors.forEach((hex) => {                          // :contentReference[oaicite:11]{index=11}
      const { r, g, b } = hexToRgb(hex);
      const rgbStr = hexToRgbString(hex);
      const cmykStr = rgbToCmykString({ r, g, b });

      // Create a container for each color: circle + HEX + RGB
      const colorDiv = $("<div>").addClass("d-flex flex-column align-items-center");
      const circle = $("<div>")
        .addClass("color-circle mb-2")
        .css("background-color", hex);
      const labelHex = $("<p>").addClass("mb-1").text(hex);
      const labelRgb = $("<p>").addClass("mb-1").text(rgbStr);
      colorDiv.append(circle, labelHex, labelRgb);
      circlesContainer.append(colorDiv);
    });

    // Append CMYK lines beneath all circles
    validColors.forEach((hex) => {                           // :contentReference[oaicite:12]{index=12}
      const cmykStr = rgbToCmykString(hexToRgb(hex));
      const cmykP = $("<p>").text(cmykStr);
      codesContainer.append(cmykP);
    });

    // Show the modal via Bootstrap’s JS API :contentReference[oaicite:13]{index=13}
    const modal = new bootstrap.Modal(document.getElementById("paletteModal"));
    modal.show();
  }

  // ─── Render palette cards in a responsive grid (no padding for short palettes) ─
  function renderPalettes(palettes) {
    const container = $("#palettes-container");
    container.empty();

    if (!palettes.length) {
      container.html("<p class='text-white-50'>No palettes found.</p>");
      return;
    }

    palettes.forEach((palette, idx) => {
      // Create the card container
      const card = $("<div>").addClass("palette-card").attr("data-index", idx);

      // Filter out any falsy values before creating blocks :contentReference[oaicite:14]{index=14}
      const validColors = palette.filter((hex) => typeof hex === "string" && hex.startsWith("#"));

      // For each valid hex, append exactly one color-block
      validColors.forEach((hex) => {                         // :contentReference[oaicite:15]{index=15}
        const block = $("<div>")
          .addClass("color-block")
          .css("background-color", hex)
          .attr("data-hex", hex);
        const codeLabel = $("<span>").text(hex);
        block.append(codeLabel);
        card.append(block);
      });

      // Add the “View Details” overlay (no copy logic) 
      const overlay = $('<div class="copy-overlay">View Details</div>');
      card.append(overlay);

      // Clicking overlay opens modal
      overlay.on("click", function (e) {
        e.stopPropagation();
        openPaletteModal(palette);
      });

      // Clicking anywhere else on card also opens modal
      card.on("click", function () {
        openPaletteModal(palette);
      });

      container.append(card);
    });
  }

  // ─── Handle form submission: show loader, POST to /api/palettes, render results ─
  $("#palette-form").on("submit", function (e) {
    e.preventDefault();

    const promptText = $("#user_prompt").val().trim();
    const tagsText = $("#tags_input").val().trim();

    if (!promptText) {
      alert("Please describe the color theme.");
      return;
    }

    // If user typed a number in their prompt, use it; otherwise default to 6 
    let numMatch = promptText.match(/(\d+)/);
    let numPalettes = numMatch ? parseInt(numMatch[1], 10) : 6;

    // Show loader overlay and start cycling captions :contentReference[oaicite:18]{index=18}
    captionIndex = 0;
    $("#loader-caption").text(captions[0]);
    $("#loader-overlay").addClass("show");
    captionInterval = setInterval(cycleCaptions, 1500);

    // Dispatch AJAX POST to backend
    $.ajax({
      type: "POST",
      url: "/api/palettes",
      data: {
        user_prompt: promptText,
        tags: tagsText,
        count: numPalettes
      },
      success: function (response) {
        clearInterval(captionInterval);
        $("#loader-overlay").removeClass("show");

        // Show/hide reasoning based on presence of text 
        if (response.reasoning) {
          $("#reasoning-container")
            .html(`<p>${response.reasoning}</p>`)
            .show();
        } else {
          $("#reasoning-container")
            .empty()
            .hide();
        }

        // Finally, render the palette cards with no padding :contentReference[oaicite:20]{index=20}
        renderPalettes(response.palettes || []);
      },
      error: function () {
        clearInterval(captionInterval);
        $("#loader-overlay").removeClass("show");
        alert("Oops! Something went wrong. Please try again.");
      }
    });
  });
});
