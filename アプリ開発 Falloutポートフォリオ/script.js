// ==================== BOOT SEQUENCE ====================
const bootLines = [
  "ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL",
  "COPYRIGHT 2075-2077 ROBCO INDUSTRIES",
  "-Server 1-",
  "INITIALIZING...",
  "LOADING USER PROFILE.....",
  "CONNECTION ESTABLISHED",
  "",
  "PLEASE STAND BY"
];

const bootTextEl = document.getElementById("boot-text");
const bootScreen = document.getElementById("boot-screen");
const app = document.getElementById("app");

function typeBootSequence(lines, el, onDone) {
  let lineIndex = 0;
  let charIndex = 0;
  let buffer = "";

  function step() {
    if (lineIndex >= lines.length) {
      onDone();
      return;
    }
    const currentLine = lines[lineIndex];
    if (charIndex < currentLine.length) {
      buffer += currentLine[charIndex];
      el.textContent = buffer;
      charIndex++;
      setTimeout(step, 12);
    } else {
      buffer += "\n";
      el.textContent = buffer;
      lineIndex++;
      charIndex = 0;
      setTimeout(step, 120);
    }
  }
  step();
}

typeBootSequence(bootLines, bootTextEl, () => {
  setTimeout(() => {
    bootScreen.classList.add("hidden");
    app.classList.remove("hidden");
  }, 500);
});

// ==================== TAB SWITCHING ====================
const tabs = document.querySelectorAll(".pb-tab");
const panels = document.querySelectorAll(".pb-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));

    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ==================== COLOR TOGGLE (green / amber) ====================
const hueToggle = document.getElementById("hue-toggle");
hueToggle.addEventListener("click", () => {
  document.body.classList.toggle("amber-mode");
});
