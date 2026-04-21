const BPF_STAGES = {
  DRAFT: 971270006,
  INTAKE_REQUEST_REVIEW: 971270000,
  DRAFT_BUSINESS_CASE: 971270001,
  SCHEDULE_GRT_MEETING: 100000001,
  GRT_MEETING: 971270002,
  FINAL_BUSINESS_CASE: 971270003,
  SCHEDULE_GRB_REVIEW: 100000002,
  GRB_REVIEW: 971270004,
  AWAITING_DECISION: 971270007,
  DECISION: 971270005,
  ISSUE_LCID: 971270008,
  FINISHED: 971270009,
  REQUEST_TYPE: 971270010,
  GOVERNANCE_PROCESS_STEPS: 971270011,
};

const ALL_SECTIONS = [
  "section_governance_process_steps",
  "section_request_type",
  "section_progress_tracker",
  "section_linked_systems",
  "section_contact_details",
  "section_request_details",
  "section_contract_details",
  "section_additional_documentation",
  "section_request_submit",
  "section_business_case",
  "section_grt_meeting",
  "section_final_business_case_review",
  "section_grb_review",
  "section_awaiting_decision",
  "section_decision",
  "section_intake_request_complete",
];

//Use this map like building blocks.
//List each section that you want to see on a certain page like a component
//Hide the section, but make sure the elements inside the section are visible
const PAGES = {
  REQUEST_TYPE: ["section_request_type"],
  GOVERNANCE_STEPS: ["section_governance_process_steps"],
  INTAKE: [
    "section_progress_tracker",
    "section_linked_systems",
    "section_contact_details",
    "section_request_details",
    "section_contract_details",
    "section_additional_documentation",
    "section_request_submit",
  ],
  BUSINESS_CASE: ["section_progress_tracker", "section_business_case"],
  GRT_MEETING: ["section_progress_tracker", "section_grt_meeting"],
  FINAL_BUSINESS_CASE: [
    "section_progress_tracker",
    "section_final_business_case_review",
  ],
  GRB_REVIEW: ["section_progress_tracker", "section_grb_review"],
  AWAITING_DECISION: ["section_progress_tracker", "section_awaiting_decision"],
  DECISION: ["section_progress_tracker", "section_decision"],
  FINISHED: [
    "section_intake_request_decision",
    "section_complete_lcid",
    "section_complete_next_steps",
    "section_request_complete_questsions",
  ],
};

const ALWAYS_REQUIRED_FIELDS = [];

const STAGE_TO_PAGE = {
  [BPF_STAGES.REQUEST_TYPE]: "REQUEST_TYPE",
  [BPF_STAGES.GOVERNANCE_PROCESS_STEPS]: "GOVERNANCE_STEPS",
  [BPF_STAGES.DRAFT]: "INTAKE",
  [BPF_STAGES.INTAKE_REQUEST_REVIEW]: "INTAKE",
  [BPF_STAGES.DRAFT_BUSINESS_CASE]: "BUSINESS_CASE",
  [BPF_STAGES.SCHEDULE_GRT_MEETING]: "GRT_MEETING",
  [BPF_STAGES.GRT_MEETING]: "GRT_MEETING",
  [BPF_STAGES.FINAL_BUSINESS_CASE]: "FINAL_BUSINESS_CASE",
  [BPF_STAGES.SCHEDULE_GRB_REVIEW]: "GRB_REVIEW",
  [BPF_STAGES.GRB_REVIEW]: "GRB_REVIEW",
  [BPF_STAGES.AWAITING_DECISION]: "AWAITING_DECISION",
  [BPF_STAGES.DECISION]: "DECISION",
  [BPF_STAGES.ISSUE_LCID]: "DECISION",
  [BPF_STAGES.FINISHED]: "FINISHED",
};

function onLoad(executionContext) {
  const formContext = executionContext.getFormContext();

  var userSettings = Xrm.Utility.getGlobalContext().userSettings;
  var currentUserId = userSettings.userId;
  var currentUserName = userSettings.userName;

  try {
    const requesterAttr = formContext.getAttribute("cr69a_requester");
    if (
      requesterAttr &&
      (!requesterAttr.getValue() || requesterAttr.getValue().length === 0)
    ) {
      requesterAttr.setValue([
        { id: currentUserId, entityType: "systemuser", name: currentUserName },
      ]);
    }
  } catch (e) {
    console.warn("Requester auto-fill skipped:", e);
  }

  registerSoftwareProductsOnChange(formContext);
  showHideFields(formContext);
  onLoadDebugToggle(formContext);
  onDecisionChange(formContext);

  const readyForReview = formContext
    .getAttribute("cr69a_readyforreview")
    ?.getValue();

  if (readyForReview) {
    lockAllFields(formContext);
  }
  updateProgressTracker(formContext);
}

function registerSoftwareProductsOnChange(formContext) {
  const softwareAttr = formContext.getAttribute("cr69a_software_products");
  if (!softwareAttr) {
    console.warn("Attribute not found: cr69a_software_products");
    return;
  }

  // Remove before add to avoid duplicate handlers on refreshes.
  softwareAttr.removeOnChange(onSoftwareProductsChange);
  softwareAttr.addOnChange(onSoftwareProductsChange);
}

function onAdminGovTaskListChange(executionContext) {
  const formContext = executionContext.getFormContext();
  showHideFields(formContext);
  updateProgressTracker(formContext);
}

function onSoftwareProductsChange(executionContext) {
  const formContext = executionContext.getFormContext();
  updateSoftwareAcquisitionVisibility(formContext);
}

/** Yes for cr69a_software_products: boolean two-option, or local choice codes used in migrations. */
function isSoftwareProductsYes(value) {
  return value === true || value === 971270000;
}

function updateSoftwareAcquisitionVisibility(formContext) {
  const softwareAttr = formContext.getAttribute("cr69a_software_products");
  const softwareCtrl = formContext.getControl("cr69a_software_products");
  const acquisitionCtrl = formContext.getControl(
    "cr69a_howwillthesoftwarebeacquired",
  );
  const acquisitionAttr = formContext.getAttribute(
    "cr69a_howwillthesoftwarebeacquired",
  );

  // Parent question should always be visible.
  softwareCtrl?.setVisible(true);

  if (!acquisitionCtrl) return;

  const show = isSoftwareProductsYes(softwareAttr?.getValue());

  acquisitionCtrl.setVisible(show);
  if (!acquisitionAttr) return;

  if (show) {
    return;
  }

  acquisitionAttr.setRequiredLevel("none");
  acquisitionAttr.setValue(null);
}

function onLoadDebugToggle(formContext) {
  var debugMode = localStorage.getItem("debugMode") === "true";

  if (debugMode) {
    const adminGovTaskListValue = formContext
      .getAttribute("new_admingovernanceprocessstep")
      .getValue();
    const fields = [];

    if (adminGovTaskListValue === BPF_STAGES.DRAFT_BUSINESS_CASE) {
      fields.push(
        "cr69a_initialbusinesscasesubmitted",
        "cr69a_initialbusinesscasesubmitteddate",
      );
    }

    if (adminGovTaskListValue === BPF_STAGES.FINAL_BUSINESS_CASE) {
      fields.push(
        "cr69a_finalbusinesscasesubmitted",
        "cr69a_finalbusinesscasesubmitteddate",
      );
    }

    fields.forEach(function (fieldName) {
      var ctrl = formContext.getControl(fieldName);
      if (ctrl) {
        ctrl.setVisible(true);
      }
    });

    const section = formContext.ui.tabs
      .get("General")
      ?.sections.get("admin_tools_section");
    section?.setVisible(true);

    console.log("Debug mode ON: showing hidden fields.");
  }
}

const DECISIONS = {
  ISSUE_LCID: 971270000,
  NOT_AN_IT_GOV_REQUEST: 971270001,
  NOT_APPROVED_BY_GRB: 971270002,
  CLOSE_REQUEST: 971270003,
};

function onDecisionChange(formContext) {
  console.log("on decision change");
  const decision = formContext.getAttribute("easi_decision")?.getValue();
  const lcid_section = formContext.ui.tabs
    .get("General")
    ?.sections.get("section_complete_lcid");
  const next_steps_section = formContext.ui.tabs
    .get("General")
    ?.sections.get("section_complete_next_steps");

  if (decision === DECISIONS.ISSUE_LCID) {
    formContext.getControl("lcid_quick_view")?.setVisible(true);
    lcid_section?.setVisible(true);
  } else if (decision === DECISIONS.NOT_AN_IT_GOV_REQUEST) {
    formContext.getControl("lcid_quick_view")?.setVisible(false);
    lcid_section?.setVisible(false);
    next_steps_section?.setVisible(false);
  } else if (decision === DECISIONS.NOT_APPROVED_BY_GRB) {
    formContext.getControl("lcid_quick_view")?.setVisible(false);
    lcid_section?.setVisible(false);
    next_steps_section?.setVisible(true);
  } else if (decision === DECISIONS.CLOSE_REQUEST) {
    formContext.getControl("lcid_quick_view")?.setVisible(false);
    lcid_section?.setVisible(false);
    next_steps_section?.setVisible(false);
  }
}

function showHideFields(formContext) {
  const isNew = !formContext.data.entity.getId();
  const stage = formContext
    .getAttribute("new_admingovernanceprocessstep")
    ?.getValue();

  // new record should start at request type page
  const pageName = isNew ? "REQUEST_TYPE" : STAGE_TO_PAGE[stage] || "INTAKE";

  showPage(formContext, pageName);

  updateSoftwareAcquisitionVisibility(formContext);

  const readyForReview = formContext
    .getAttribute("cr69a_readyforreview")
    ?.getValue();
  if (readyForReview) return;

  if (pageName === "FINISHED") {
    lockAllFields(formContext);
  }
}

function showPage(formContext, pageName) {
  const tab = formContext.ui.tabs.get("General");
  if (!tab) return console.error("Tab not found: General");

  const visibleSections = new Set(PAGES[pageName] || []);

  ALL_SECTIONS.forEach((sectionName) => {
    const section = tab.sections.get(sectionName);
    if (!section) return console.warn(`Section not found: ${sectionName}`);
    section.setVisible(visibleSections.has(sectionName));
  });
}

function lockAllFields(formContext) {
  if (parent.lockAllFields) {
    parent.lockAllFields(formContext);
  } else {
    console.warn("lockAllFields function not found on parent window");
  }
}

function updateProgressTracker(formContext, attempt = 0) {
  const tab = formContext.ui.tabs.get("General");
  const trackerSectionVisible = tab?.sections
    .get("section_progress_tracker")
    ?.getVisible();

  if (!trackerSectionVisible) return;

  const statusValue = formContext
    .getAttribute("new_admingovernanceprocessstep")
    ?.getValue();

  const webResourceControl = formContext.getControl(
    "WebResource_progress_tracker",
  );
  if (!webResourceControl || !statusValue) return;

  webResourceControl.getContentWindow().then(
    (contentWindow) => {
      if (typeof contentWindow.updateProgress === "function") {
        contentWindow.updateProgress(statusValue);
      } else if (attempt < 10) {
        // web resource loaded but function not ready yet
        setTimeout(() => updateProgressTracker(formContext, attempt + 1), 200);
      }
    },
    () => {
      if (attempt < 10) {
        setTimeout(() => updateProgressTracker(formContext, attempt + 1), 200);
      }
    },
  );
}

function clearCustomNotificationsOnSave(executionContext) {
  const formContext = executionContext.getFormContext();
  console.log("clearCustomNotificationsOnSave");

  formContext.ui.controls.forEach(function (control) {
    try {
      if (
        control &&
        typeof control.clearNotification === "function" &&
        typeof control.getControlType === "function" &&
        typeof control.getAttribute === "function"
      ) {
        const attribute = control.getAttribute();
        if (attribute) {
          control.clearNotification("required_check");
        }
      }
    } catch (e) {
      // Ignore unsupported controls
    }
  });
  console.log("clearCustomNotificationsOnSave end");
}
