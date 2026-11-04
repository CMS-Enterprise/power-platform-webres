(function () {
  var NOTIFICATION_ID_SUFFIX = "_itgov_help";

  // TODO: fill in help text for each field.
  var FIELD_HELP = {
    cr69a_enterprise_architecture_support: "If you are unsure, mark \"Yes\" and someone from the EA team will assess your needs. You may also reach out to EA directly at EnterpriseArchitecture@cms.hhs.gov.",
    cr69a_ai_technologies_used: "Select \"Yes\" if you are considering using AI for this request, even if you are not yest sure. This could be for new development or enhancement to an existing solution. For general AI related questions, please contact the AI team at AI@cms.hhs.gov. For more targeted and specific AI inquiries, please reach out to the Technical Review Board (TRB) for assistance.",
  };

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

  function showFieldHelp(formContext, controlName, message) {
    var control = formContext.getControl(controlName);

    if (!control || typeof control.addNotification !== "function") {
      console.log(
        "[intakeRequestFieldHelp] control not available: " + controlName,
      );
      return;
    }

    var notificationId = controlName + NOTIFICATION_ID_SUFFIX;
    control.clearNotification(notificationId);

    if (!message) {
      return;
    }

    control.addNotification({
      messages: [message],
      notificationLevel: "RECOMMENDATION",
      uniqueId: notificationId,
    });
  }

  window.ITGov_IntakeRequestFieldHelpOnLoad = function (executionContext) {
    var formContext = getFormContext(executionContext);

    if (!formContext) {
      console.log("[intakeRequestFieldHelp] form context not available");
      return;
    }

    Object.keys(FIELD_HELP).forEach(function (controlName) {
      showFieldHelp(formContext, controlName, FIELD_HELP[controlName]);
    });
  };
})();
