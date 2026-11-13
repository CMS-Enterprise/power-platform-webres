(function () {
  var LOG_PREFIX = "[solutionMainForm]";

  // Mirrors the Request form (intakeRequest.js shouldLockRequest): the
  // Solution is read-only while its Request is submitted for admin review,
  // closed, or finished, and editable when the Request is back with the
  // requester (Edit Request or progressed to a new step).
  var READY_FOR_REVIEW = "cr69a_readyforreview";
  var REQUEST_STATUS = "cr69a_status";
  var REQUEST_STATUS_CLOSED = 100000000;
  var ADMIN_STEP = "new_admingovernanceprocessstep";
  var FINISHED_STEP = 971270009;
  var DRAFT_BUSINESS_CASE_STEP = 971270001;

  // Same toggle as solutionQuickCreateZeroTrustInfo.js: when false, these
  // metadata-required fields are optional while the Request is at Draft
  // Business Case. Set to true to require them at Draft as well.
  var ENFORCE_REQUIRED_FIELDS = false;

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

  // Requester-editable fields. These are read-only in the form XML, so the
  // form stays locked by default (including when the Request can't be
  // loaded) and is unlocked here only when the Request is with the requester.
  var EDITABLE_FIELDS = [
    "cr69a_solutiontitle",
    "cr69a_sumary",
    "cr69a_targetcontractaward",
    "cr69a_targetcompletionofdevelopmentwork",
    "cr69a_acquisitionapproachmulti",
    "cr69a_securityisapproved",
    "cr69a_securityisbeingreviewed",
    "cr69a_approvedforuseatcms",
    "cr69a_zerotrustprinciplealignment",
    "cr69a_doyouneedtohostyoursolution",
    "cr69a_cloudhostingstrategy",
    "cr69a_hostingcloudservicetype",
    "cr69a_hasui",
    "cr69a_workforcetrainingrequirements",
    "cr69a_prosmulti",
    "cr69a_consmulti",
    "new_fy1costperyear",
    "new_fy2costperyear",
    "new_fy3costperyear",
    "new_fy4costperyear",
    "new_fy5costperyear",
    "cr69a_costimpact",
  ];

  function cleanGuid(value) {
    return value ? String(value).replace(/[{}]/g, "") : "";
  }

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

  function getRequestIdFromBusinessCase(businessCaseId) {
    if (!businessCaseId) return Promise.resolve("");

    return Xrm.WebApi.retrieveRecord(
      "cr69a_businesscase",
      businessCaseId,
      "?$select=_easi_system_intake_value",
    ).then(function (businessCase) {
      return cleanGuid(businessCase && businessCase._easi_system_intake_value);
    });
  }

  // The parent lookups aren't on this form, so read them from the saved
  // Solution. New (unsaved) records fall back to the launching record.
  function getRequestId(formContext) {
    var solutionId = cleanGuid(formContext.data.entity.getId());

    if (!solutionId) {
      var requestId = getCreateFromEntity("new_systemintake");
      if (requestId) return Promise.resolve(requestId);
      return getRequestIdFromBusinessCase(
        getCreateFromEntity("cr69a_businesscase"),
      );
    }

    return Xrm.WebApi.retrieveRecord(
      "cr69a_businesscasesolution",
      solutionId,
      "?$select=_new_request_value,_easi_cr69a_businesscase_value",
    ).then(function (solution) {
      var requestId = cleanGuid(solution && solution._new_request_value);
      if (requestId) return requestId;
      return getRequestIdFromBusinessCase(
        cleanGuid(solution && solution._easi_cr69a_businesscase_value),
      );
    });
  }

  function getRequest(formContext) {
    return getRequestId(formContext).then(function (requestId) {
      if (!requestId) return null;

      return Xrm.WebApi.retrieveRecord(
        "new_systemintake",
        requestId,
        "?$select=" + [READY_FOR_REVIEW, REQUEST_STATUS, ADMIN_STEP].join(","),
      );
    });
  }

  function shouldLock(request) {
    return (
      request[READY_FOR_REVIEW] === true ||
      request[REQUEST_STATUS] === REQUEST_STATUS_CLOSED ||
      request[ADMIN_STEP] === FINISHED_STEP
    );
  }

  function lockAllFields(formContext) {
    if (parent && typeof parent.lockAllFields === "function") {
      parent.lockAllFields(formContext);
      return;
    }

    formContext.ui.controls.forEach(function (control) {
      if (control && typeof control.setDisabled === "function") {
        control.setDisabled(true);
      }
    });
  }

  function unlockEditableFields(formContext) {
    EDITABLE_FIELDS.forEach(function (fieldName) {
      var control = formContext.getControl(fieldName);
      if (control && typeof control.setDisabled === "function") {
        control.setDisabled(false);
      }
    });
  }

  function relaxRequiredFields(formContext) {
    REQUIRED_FIELDS.forEach(function (fieldName) {
      var attribute = formContext.getAttribute(fieldName);
      if (attribute && typeof attribute.setRequiredLevel === "function") {
        attribute.setRequiredLevel("none");
      }
    });
  }

  window.ITGov_SolutionMainFormOnLoad = function (executionContext) {
    var formContext =
      executionContext && typeof executionContext.getFormContext === "function"
        ? executionContext.getFormContext()
        : null;

    if (!formContext) {
      console.log(LOG_PREFIX, "form context not available");
      return;
    }

    getRequest(formContext).then(
      function (request) {
        if (!request) {
          console.log(LOG_PREFIX, "no parent Request found; leaving locked");
          return;
        }

        if (shouldLock(request)) {
          lockAllFields(formContext);
          return;
        }

        unlockEditableFields(formContext);

        if (
          !ENFORCE_REQUIRED_FIELDS &&
          request[ADMIN_STEP] === DRAFT_BUSINESS_CASE_STEP
        ) {
          relaxRequiredFields(formContext);
        }
      },
      function (error) {
        console.error(
          LOG_PREFIX,
          "unable to load parent Request; leaving locked",
          error,
        );
      },
    );
  };
})();
