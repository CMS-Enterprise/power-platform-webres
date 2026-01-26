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
    "section_progress_tracker",
    "section_linked_systems",
    "section_contact_details",
    "section_request_details",
    "section_contract_details",
    "section_additional_documentation",
    "section_business_case",
    "section_grt_meeting",
    "section_final_business_case_review",
    "section_grb_review",
    "section_decision",
    "section_intake_request_complete",
  ],
};

const PAGE_REQUIRED_FIELDS = {
  REQUEST_TYPE: [],
  GOVERNANCE_STEPS: [],
  INTAKE: [
    "cr69a_requester",
    "cr69a_requestercomponent",
    "cr69a_cmsbusinessownername",
    "cr69a_cmsbusinessownercomponent",
    "cr69a_cmsprojectproductmanager",
    "cr69a_cmsproductmanagercomponent",
    "cr69a_collaborators",
    "cr69a_business_need",
    "cr69a_solution",
    "cr69a_current_process_status",
    "cr69a_enterprise_architecture_support",
    "cr69a_ai_technologies_used",
    "cr69a_interface_component",
    "cr69a_software_products",
    "cr69a_annual_spending",
    "cr69a_current_it_spending_portion",
    "cr69a_planned_annual_spending",
    "cr69a_whatportionofyr1plannedannualspendingisit",
    "cr69a_doesthisrequestalreadyhavecontractsupport",
  ],
  BUSINESS_CASE: ["cr69a_businesscase"],
  GRT_MEETING: [],
  FINAL_BUSINESS_CASE: ["cr69a_finalbusinesscase"],
  GRB_REVIEW: [],
  AWAITING_DECISION: [],
  DECISION: [],
  FINISHED: [],
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

  showHideFields(formContext);
  onLoadDebugToggle(formContext);

  const readyForReview = formContext
    .getAttribute("cr69a_readyforreview")
    ?.getValue();

  if (readyForReview) {
    lockAllFields(formContext);
  }
  updateProgressTracker(formContext);
}

function onAdminGovTaskListChange(executionContext) {
  const formContext = executionContext.getFormContext();
  showHideFields(formContext);
  updateProgressTracker(formContext);
}

function onLoadDebugToggle(formContext) {
  var debugMode = localStorage.getItem("debugMode") === "true";

  if (debugMode) {
    const adminGovTaskListValue = formContext
      .getAttribute("cr69a_admingovernancetasklist")
      .getValue();
    const fields = [];

    if (adminGovTaskListValue === BPF_STAGES.DRAFT_BUSINESS_CASE) {
      fields.push(
        "cr69a_initialbusinesscasesubmitted",
        "cr69a_initialbusinesscasesubmitteddate"
      );
    }

    if (adminGovTaskListValue === BPF_STAGES.FINAL_BUSINESS_CASE) {
      fields.push(
        "cr69a_finalbusinesscasesubmitted",
        "cr69a_finalbusinesscasesubmitteddate"
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

function showHideFields(formContext) {
  const isNew = !formContext.data.entity.getId();
  const stage = formContext
    .getAttribute("cr69a_admingovernancetasklist")
    ?.getValue();

  // new record should start at request type page
  const pageName = isNew ? "REQUEST_TYPE" : STAGE_TO_PAGE[stage] || "INTAKE";

  showPage(formContext, pageName);

  const readyForReview = formContext
    .getAttribute("cr69a_readyforreview")
    ?.getValue();
  if (readyForReview) return;

  applyRequiredFieldsForPage(formContext, pageName);

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
    .getAttribute("cr69a_admingovernancetasklist")
    ?.getValue();

  const webResourceControl = formContext.getControl(
    "WebResource_progress_tracker"
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
    }
  );
}

function getAllWizardRequiredFields() {
  const all = new Set(ALWAYS_REQUIRED_FIELDS);
  Object.values(PAGE_REQUIRED_FIELDS).forEach((arr) => {
    (arr || []).forEach((f) => all.add(f));
  });
  return Array.from(all);
}

function setFieldRequired(formContext, logicalName, isRequired) {
  const attr = formContext.getAttribute(logicalName);
  if (!attr) {
    console.warn(
      `Required mapping references missing attribute: ${logicalName}`
    );
    return;
  }
  attr.setRequiredLevel(isRequired ? "required" : "none");
}

function applyRequiredFieldsForPage(formContext, pageName) {
  if (!Object.prototype.hasOwnProperty.call(PAGE_REQUIRED_FIELDS, pageName)) {
    console.error(`Unknown pageName for required fields: ${pageName}`);
    return;
  }

  const allWizardFields = getAllWizardRequiredFields();
  const pageFields = new Set([
    ...(PAGE_REQUIRED_FIELDS[pageName] || []),
    ...ALWAYS_REQUIRED_FIELDS,
  ]);

  // First, clear required for all wizard-managed fields
  allWizardFields.forEach((fieldName) =>
    setFieldRequired(formContext, fieldName, false)
  );

  // Then, set required only for current page fields
  pageFields.forEach((fieldName) =>
    setFieldRequired(formContext, fieldName, true)
  );
}
