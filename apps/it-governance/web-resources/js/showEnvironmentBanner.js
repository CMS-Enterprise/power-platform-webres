let envNotifId = null;

function showEnvironmentBanner() {
  const environment = Xrm.Utility.getGlobalContext().getClientUrl();

  let text = "";
  let level = "INFO"; // INFO | WARNING | ERROR

  if (
    environment.includes("org389e8766") ||
    environment.includes("dev.") ||
    environment.includes("itgovernancedev")
  ) {
    text = "🔧 DEVELOPMENT ENVIRONMENT";
    level = "WARNING";
  } else if (
    environment.includes("org1e8d7583") ||
    environment.includes("test.") ||
    environment.includes("itgovernanceuat")
  ) {
    text = "🧪 UAT ENVIRONMENT";
    level = "INFO";
  } else if (
    environment.includes("org23bd7f3b") ||
    environment.includes("prod.") ||
    environment === "itgovernance"
  ) {
    text = "⚠️ PRODUCTION ENVIRONMENT";
    level = "ERROR";
  }

  if (!text) return;

  // avoid duplicates
  if (envNotifId) return;

  Xrm.App.addGlobalNotification({
    type: 2, // 2 = banner
    level: level, // "INFO" | "WARNING" | "ERROR"
    message: text,
    showCloseButton: false,
  }).then(function (id) {
    envNotifId = id;
  });
}
