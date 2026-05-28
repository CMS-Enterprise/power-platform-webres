(function () {
  var CONTROL_NAME = "cr69a_zerotrustprinciplealignment";
  var NOTIFICATION_ID = "itgov-zero-trust-info";
  var ZERO_TRUST_URL = "https://security.cms.gov/learn/zero-trust";

  function getFormContext(executionContext) {
    if (
      executionContext &&
      typeof executionContext.getFormContext === "function"
    ) {
      return executionContext.getFormContext();
    }

    if (typeof Xrm !== "undefined" && Xrm.Page) {
      return Xrm.Page;
    }

    return null;
  }

  function openZeroTrustGuidance() {
    if (
      typeof Xrm !== "undefined" &&
      Xrm.Navigation &&
      typeof Xrm.Navigation.openUrl === "function"
    ) {
      Xrm.Navigation.openUrl(ZERO_TRUST_URL);
      return;
    }

    window.open(ZERO_TRUST_URL, "_blank", "noopener,noreferrer");
  }

  function showZeroTrustNotification(formContext) {
    var control = formContext.getControl(CONTROL_NAME);

    if (!control || typeof control.addNotification !== "function") {
      console.log(
        "[solutionQuickCreateZeroTrustInfo] zero trust alignment control not available",
      );
      return;
    }

    control.clearNotification(NOTIFICATION_ID);
    control.addNotification({
      messages: ["Zero Trust guidance"],
      notificationLevel: "RECOMMENDATION",
      uniqueId: NOTIFICATION_ID,
      actions: [
        {
          message: "Open CMS Zero Trust policy information.",
          actions: [openZeroTrustGuidance],
        },
      ],
    });
  }

  window.ITGov_SolutionQuickCreateZeroTrustInfoOnLoad = function (
    executionContext,
  ) {
    var formContext = getFormContext(executionContext);

    if (!formContext) {
      console.log(
        "[solutionQuickCreateZeroTrustInfo] form context not available",
      );
      return;
    }

    showZeroTrustNotification(formContext);
  };
})();
