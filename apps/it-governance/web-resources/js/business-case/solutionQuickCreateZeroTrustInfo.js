(function () {
  var CONTROL_NAME = "cr69a_zerotrustprinciplealignment";
  var NOTIFICATION_ID = "itgov-zero-trust-info";
  var ZERO_TRUST_URL = "https://security.cms.gov/learn/zero-trust";

  // Toggle for Solution field requirements during Draft Business Case. These
  // fields are "required" in the cr69a_businesscasesolution entity metadata.
  // When false and the parent Request is at Draft Business Case, the
  // requirement is cleared on this form so a Solution can be saved without
  // them. At every other step (including Final Business Case) the metadata
  // requirement applies. Set to true to require them at Draft as well.
  var ENFORCE_REQUIRED_FIELDS = false;

  var DRAFT_BUSINESS_CASE_STEP = 971270001;
  var ADMIN_STEP = "new_admingovernanceprocessstep";
  var REQUEST_LOOKUP = "new_request";
  var BUSINESS_CASE_LOOKUP = "easi_cr69a_businesscase";

  var REQUIRED_FIELDS = [
    "cr69a_solutiontitle",
    "cr69a_solution_type",
    "cr69a_sumary",
    "cr69a_acquisitionapproachmulti",
    "cr69a_approvedforuseatcms",
    "cr69a_zerotrustprinciplealignment",
    "cr69a_hasui",
    "cr69a_workforcetrainingrequirements",
    "cr69a_costimpact",
  ];

  function cleanGuid(value) {
    return value ? String(value).replace(/[{}]/g, "") : "";
  }

  function getLookupId(formContext, fieldName) {
    var attribute = formContext.getAttribute(fieldName);
    var value = attribute ? attribute.getValue() : null;
    return value && value.length ? cleanGuid(value[0].id) : "";
  }

  // Fallback for when the prefilled lookups are not on the form: the record
  // the quick create was launched from (e.g. the parent form's subgrid).
  function getCreateFromEntity(entityName) {
    try {
      var pageContext =
        Xrm.Utility &&
        typeof Xrm.Utility.getPageContext === "function" &&
        Xrm.Utility.getPageContext();
      var parentRef =
        pageContext && pageContext.input && pageContext.input.createFromEntity;
      if (parentRef && parentRef.entityType === entityName) {
        return cleanGuid(parentRef.id);
      }
    } catch (e) {
      // Page context unavailable; fall through.
    }
    return "";
  }

  // Resolve the parent Request's id. The quick create is prefilled with
  // either the Request lookup or the Business Case lookup depending on which
  // form's subgrid launched it. These lookups must be on the form (hidden is
  // fine) for getAttribute to see them; otherwise fall back to page context.
  function getRequestId(formContext) {
    var requestId =
      getLookupId(formContext, REQUEST_LOOKUP) ||
      getCreateFromEntity("new_systemintake");
    if (requestId) return Promise.resolve(requestId);

    var businessCaseId =
      getLookupId(formContext, BUSINESS_CASE_LOOKUP) ||
      getCreateFromEntity("cr69a_businesscase");
    if (!businessCaseId) return Promise.resolve("");

    return Xrm.WebApi.retrieveRecord(
      "cr69a_businesscase",
      businessCaseId,
      "?$select=_easi_system_intake_value",
    ).then(function (businessCase) {
      return cleanGuid(businessCase && businessCase._easi_system_intake_value);
    });
  }

  function isDraftBusinessCaseStep(formContext) {
    return getRequestId(formContext).then(function (requestId) {
      if (!requestId) return false;

      return Xrm.WebApi.retrieveRecord(
        "new_systemintake",
        requestId,
        "?$select=" + ADMIN_STEP,
      ).then(function (request) {
        return !!request && request[ADMIN_STEP] === DRAFT_BUSINESS_CASE_STEP;
      });
    });
  }

  // Leaves the metadata requirement in place unless the parent Request is
  // confirmed to be at Draft Business Case, so lookup failures fail safe.
  function applyRequiredLevels(formContext) {
    if (ENFORCE_REQUIRED_FIELDS) return;

    isDraftBusinessCaseStep(formContext).then(
      function (isDraft) {
        if (!isDraft) return;

        REQUIRED_FIELDS.forEach(function (fieldName) {
          var attribute = formContext.getAttribute(fieldName);
          if (attribute && typeof attribute.setRequiredLevel === "function") {
            attribute.setRequiredLevel("none");
          }
        });
      },
      function (error) {
        console.log(
          "[solutionQuickCreateZeroTrustInfo] unable to determine Request step; keeping required fields",
          error,
        );
      },
    );
  }

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

    applyRequiredLevels(formContext);
    showZeroTrustNotification(formContext);
  };
})();
