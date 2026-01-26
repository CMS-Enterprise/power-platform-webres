function addEnvironmentBanner() {
  // Prevent duplicate banners
  if (document.getElementById("environmentBanner")) {
    return;
  }

  var environment = Xrm.Utility.getGlobalContext().getClientUrl();
  var bannerText = "";
  var bannerColor = "";
  var textColor = "#ffffff";

  // Detect environment based on URL
  if (environment.includes("org389e8766") || environment.includes("dev.")) {
    bannerText = "🔧 DEVELOPMENT ENVIRONMENT";
    bannerColor = "#ff9800"; // Orange
  } else if (
    environment.includes("org1e8d7583") ||
    environment.includes("test.")
  ) {
    bannerText = "🧪 UAT ENVIRONMENT";
    bannerColor = "#2196f3"; // Blue
  } else if (
    environment.includes("org23bd7f3b") ||
    environment.includes("prod.")
  ) {
    bannerText = "⚠️ PRODUCTION ENVIRONMENT";
    bannerColor = "#c41431"; // Red
  }

  if (bannerText) {
    createBanner(bannerText, bannerColor, textColor);
  }
}

function createBanner(text, backgroundColor, textColor) {
  console.log("create banner called");

  const doc = getTopSameOriginDocument();

  if (doc.getElementById("environmentBanner")) return;

  const banner = doc.createElement("div");
  banner.id = "environmentBanner";
  banner.textContent = text;

  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    line-height: 40px;
    background-color: ${backgroundColor};
    color: ${textColor || "#fff"};
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  `;

  // Put it at the top of the visible page
  doc.body.prepend(banner);

  // Push down the main content in the PARENT doc
  pushShellDown(doc, 40);
}

function pushShellDown(doc, offsetPx) {
  const shell = doc.getElementById("shell-container");
  if (!shell) return false;

  const offset = `${offsetPx}px`;

  // Ensure positioning allows top offset
  const computed = doc.defaultView.getComputedStyle(shell);
  if (computed.position === "static") {
    shell.style.position = "fixed";
  }

  // Apply offset once
  if (shell.style.top !== offset) {
    shell.style.top = offset;
  }

  return true;
}

// Main function to call from form OnLoad
function showEnvironmentBanner(executionContext) {
  // Small delay to ensure page is loaded
  setTimeout(addEnvironmentBanner, 1000);
}

function getTopSameOriginDocument() {
  let w = window;
  while (w.parent && w.parent !== w) {
    try {
      // Touching location.href is a quick same-origin test
      void w.parent.location.href;
      w = w.parent;
    } catch (e) {
      break; // Cross-origin, stop climbing
    }
  }
  return w.document;
}
