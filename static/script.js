// static/script.js

$(document).ready(function () {
  // Loader captions to cycle
const captions = [
  "Crafting prompt… ✍️",
  "AI is in artistic mode… 🎨",
  "Generating palettes… 🌈",
  "Converting codes to colors… 💻✨",
  "Almost there… Nearly done! 💪"
];

let captionIndex = 0;
  let captionInterval = null;

  // Toggle tag-pill .active state on click
  $(".tag-pill").on("click", function () {
    $(this).toggleClass("active");
    const activeTags = $(".tag-pill.active")
      .map(function () { return $(this).data("value"); })
      .get();
    $("#tags_input").val(activeTags.join(","));
  });

  // Cycle loader captions every 1.5 seconds
  function cycleCaptions() {
    $("#loader-caption").text(captions[captionIndex]);
    captionIndex = (captionIndex + 1) % captions.length;
  }

  // Convert a hex string to an {r,g,b} object
  function hexToRgb(hex) {
    hex = hex.replace("#", "");
    const bigint = parseInt(hex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  // Return CSS-style "rgb(r, g, b)" from hex
  function hexToRgbString(hex) {
    const { r, g, b } = hexToRgb(hex);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Convert {r,g,b} to "cmyk(C%, M%, Y%, K%)"
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

  // Open Bootstrap modal and populate with color details
  function openPaletteModal(palette) {
    const circlesContainer = $("#modal-color-circles");
    const codesContainer = $("#modal-codes");
    circlesContainer.empty();
    codesContainer.empty();

    // For each hex in palette, add one circle + HEX + RGB
    palette.forEach((hex) => {
      const { r, g, b } = hexToRgb(hex);
      const rgbStr = hexToRgbString(hex);
      const cmykStr = rgbToCmykString({ r, g, b });

      // Build a <div> containing a colored circle and labels
      const colorDiv = $("<div>").addClass("d-flex flex-column align-items-center");
      const circle = $("<div>")
        .addClass("color-circle mb-2")
        .css("background-color", hex);
      const labelHex = $("<p>").addClass("mb-1").text(hex);
      const labelRgb = $("<p>").addClass("mb-1").text(rgbStr);
      colorDiv.append(circle, labelHex, labelRgb);
      circlesContainer.append(colorDiv);
    });

    // Append CMYK lines after all circles
    palette.forEach((hex) => {
      const cmykStr = rgbToCmykString(hexToRgb(hex));
      const cmykP = $("<p>").text(cmykStr);
      codesContainer.append(cmykP);
    });

    // Show the Bootstrap modal
    const modal = new bootstrap.Modal(document.getElementById("paletteModal"));
    modal.show();
  }

  // Render palette cards into the grid
  function renderPalettes(palettes) {
    const container = $("#palettes-container");
    container.empty();

    if (!palettes.length) {
      container.html("<p class='text-white-50'>No palettes found.</p>");
      return;
    }

    palettes.forEach((palette, idx) => {
      // Create .palette-card
      const card = $("<div>").addClass("palette-card").attr("data-index", idx);

      // Add each color block
      palette.forEach((hex) => {
        const block = $("<div>")
          .addClass("color-block")
          .css("background-color", hex)
          .attr("data-hex", hex);
        const codeLabel = $("<span>").text(hex);
        block.append(codeLabel);
        card.append(block);
      });

      // Copy overlay (now opens modal)
      const overlay = $('<div class="copy-overlay">View Details</div>');
      card.append(overlay);

      // On clicking overlay, open modal
      overlay.on("click", function (e) {
        e.stopPropagation(); // Prevent card click from firing
        openPaletteModal(palette);
      });

      // Clicking anywhere else on card also opens modal
      card.on("click", function () {
        openPaletteModal(palette);
      });

      container.append(card);
    });
  }

  // Handle form submission
  $("#palette-form").on("submit", function (e) {
    e.preventDefault();

    const promptText = $("#user_prompt").val().trim();
    const tagsText = $("#tags_input").val().trim();

    if (!promptText) {
      alert("Please describe the color theme.");
      return;
    }

    // Determine number of palettes from prompt using regex
    let numMatch = promptText.match(/(\d+)/);
    let numPalettes = numMatch ? parseInt(numMatch[1], 10) : 6;

    // Show loader
    captionIndex = 0;
    $("#loader-caption").text(captions[0]);
    $("#loader-overlay").addClass("show");
    captionInterval = setInterval(cycleCaptions, 1500);

    // Send AJAX POST to /api/palettes
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

        // Show or hide reasoning container based on response
        if (response.reasoning) {
          $("#reasoning-container")
            .html(`<p>${response.reasoning}</p>`)
            .show();
        } else {
          $("#reasoning-container")
            .empty()
            .hide();
        }

        // Render palette cards
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






