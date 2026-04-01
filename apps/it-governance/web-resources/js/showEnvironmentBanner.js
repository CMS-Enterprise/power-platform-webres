function showEnvironmentBanner() {
  const url = Xrm.Utility.getGlobalContext().getClientUrl();

  let text = "";
  let bg = "";
  let color = "#ffffff";

  if (
    url.includes("org389e8766") ||
    url.includes("dev.") ||
    url.includes("itgovernancedev")
  ) {
    text = "DEV";
    bg = "#d83b01";
  } else if (
    url.includes("org1e8d7583") ||
    url.includes("test.") ||
    url.includes("itgovernanceuat")
  ) {
    text = "UAT";
    bg = "#004578";
  } else {
    return;
  }

  const badgeId = "custom-environment-badge";

  // avoid duplicates
  let badge = window.top.document.getElementById(badgeId);
  if (badge) {
    badge.textContent = text;
    badge.style.backgroundColor = bg;
    badge.style.color = color;
    return;
  }

  badge = window.top.document.createElement("div");
  badge.id = badgeId;
  badge.textContent = text;

  Object.assign(badge.style, {
    position: "fixed",
    top: "12px",
    left: "285px",
    zIndex: "99999",
    padding: "6px 10px",
    borderRadius: "999px",
    fontFamily: "'Segoe UI', sans-serif",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    backgroundColor: bg,
    color: color,
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    pointerEvents: "none",
  });

  window.top.document.body.appendChild(badge);
}
