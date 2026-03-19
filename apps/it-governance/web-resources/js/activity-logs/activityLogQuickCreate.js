function onProcessTargetStepChange(executionContext) {
  var formContext = executionContext.getFormContext();

  var stepAttr = formContext.getAttribute("new_process_target_step");
  var activityAttr = formContext.getAttribute("new_activity");

  if (!stepAttr || !activityAttr) return;

  var stepValue = stepAttr.getValue();
  if (stepValue === null || stepValue === undefined) {
    // Optional: clear activity text if step is cleared
    // activityAttr.setValue(null);
    return;
  }

  // This is the key line: get the LABEL, not the number
  var stepText = stepAttr.getText();
  if (!stepText) return;

  var description = "Request moved to " + stepText;

  activityAttr.setValue(description);
}

const ACTIVITY_TYPES = {
  ProgressToNewStep: 216640000,
  IssueALifeCycleID: 216640001,
  NotAnITGovernanceRequest: 216640002,
  NotApprovedByGRB: 216640003,
  CloseRequest: 216640004,
  EditRequest: 216640005, //not used in this context, we have another quick create for Edit Requests
  ReopenRequest: 216640006,
};

const ACTIVITY_TITLES = {
  216640000: "Progress to a New Step",
  216640001: "Issue a Life Cycle ID",
  216640002: "Not an IT Gov Request",
  216640003: "Not Approved by GRB",
  216640004: "Close Request",
  216640006: "Re-open Request",
};

// All fields we manage in this quick create
const ALL_FIELDS = [
  "cr3ee_lifecycleid",
  "cr3ee_lcid",
  "cr3ee_projectcostbaseline",
  "cr3ee_expirationdate",
  "cr3ee_scopeofthelifecycleid",
  "cr3ee_trbconsult",
  "cr3ee_reason",
  "new_process_target_step",
  "cr3ee_whyareyouclosingthisrequest",
  "new_requester_feedback",
  "new_recommendationsforthegrb",
  "new_additionalinformation",
  "new_adminnote",
  "cr3ee_nextsteps",
  "new_whyareyoureopeningthisrequest",
];

// Config per activity type
// - show: visible
// - hide: hidden
// - require: required (also implies visible in practice)
const TYPE_RULES = {
  [ACTIVITY_TYPES.ProgressToNewStep]: {
    show: [
      "new_requester_feedback",
      "new_recommendationsforthegrb",
      "new_additionalinformation",
      "new_adminnote",
    ],
    hide: [
      "cr3ee_lifecycleid",
      "cr3ee_lcid",
      "cr3ee_projectcostbaseline",
      "cr3ee_expirationdate",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_trbconsult",
      "cr3ee_reason",
      "cr3ee_whyareyouclosingthisrequest",
      "cr3ee_nextsteps",
      "new_whyareyoureopeningthisrequest",
    ],
    require: ["new_process_target_step"],
  },

  [ACTIVITY_TYPES.IssueALifeCycleID]: {
    show: [
      "cr3ee_lifecycleid",

      "cr3ee_nextsteps",
      "cr3ee_trbconsult",
      "cr3ee_projectcostbaseline",

      "new_additionalinformation",
      "new_adminnote",
    ],
    hide: [
      "cr3ee_lcid",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_expirationdate",
      "cr3ee_reason",
      "new_process_target_step",
      "cr3ee_whyareyouclosingthisrequest",
      "new_requester_feedback",
      "new_recommendationsforthegrb",
      "new_whyareyoureopeningthisrequest",
    ],
    require: ["cr3ee_lifecycleid", "cr3ee_nextsteps", "cr3ee_trbconsult"],
  },

  [ACTIVITY_TYPES.NotAnITGovernanceRequest]: {
    show: [
      "cr3ee_whyareyouclosingthisrequest",
      "new_additionalinformation",
      "new_adminnote",
    ],
    hide: [
      "cr3ee_lifecycleid",
      "cr3ee_lcid",
      "cr3ee_projectcostbaseline",
      "cr3ee_expirationdate",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_trbconsult",
      "cr3ee_reason",
      "new_process_target_step",
      "new_requester_feedback",
      "new_recommendationsforthegrb",
      "cr3ee_nextsteps",
      "new_whyareyoureopeningthisrequest",
    ],
    require: [],
  },

  [ACTIVITY_TYPES.NotApprovedByGRB]: {
    show: [
      "cr3ee_reason",
      "new_recommendationsforthegrb",
      "new_additionalinformation",
      "new_adminnote",
      "cr3ee_nextsteps",
    ],
    hide: [
      "cr3ee_lifecycleid",
      "cr3ee_lcid",
      "cr3ee_projectcostbaseline",
      "cr3ee_expirationdate",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_trbconsult",
      "new_process_target_step",
      "cr3ee_whyareyouclosingthisrequest",
      "new_requester_feedback",
      "new_whyareyoureopeningthisrequest",
    ],
    require: [],
  },

  [ACTIVITY_TYPES.CloseRequest]: {
    show: [
      "cr3ee_whyareyouclosingthisrequest",
      "new_additionalinformation",
      "new_adminnote",
    ],
    hide: [
      "cr3ee_lifecycleid",
      "cr3ee_lcid",
      "cr3ee_projectcostbaseline",
      "cr3ee_expirationdate",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_trbconsult",
      "cr3ee_reason",
      "new_process_target_step",
      "new_requester_feedback",
      "new_recommendationsforthegrb",
      "cr3ee_nextsteps",
      "new_whyareyoureopeningthisrequest",
    ],
    require: [],
  },

  [ACTIVITY_TYPES.ReopenRequest]: {
    show: [
      "new_whyareyoureopeningthisrequest",
      "new_additionalinformation",
      "new_adminnote",
    ],
    hide: [
      "cr3ee_lifecycleid",
      "cr3ee_lcid",
      "cr3ee_projectcostbaseline",
      "cr3ee_expirationdate",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_trbconsult",
      "cr3ee_reason",
      "new_process_target_step",
      "new_requester_feedback",
      "new_recommendationsforthegrb",
      "cr3ee_nextsteps",
      "cr3ee_whyareyouclosingthisrequest",
    ],
    require: [],
  },
};

function onLoad(executionContext) {
  const formContext = executionContext.getFormContext();

  // Apply immediately (handles when type is prefilled via parameters)
  applyRules(formContext);

  // Defensive: if you don't wire OnChange, this still helps in some QC experiences.
  // But best practice is still to add the OnChange handler explicitly.
}

function onActivityTypeChange(executionContext) {
  const formContext = executionContext.getFormContext();
  applyRules(formContext);
}

// cr3ee_lifecycleid option-set values
// NOTE: 216640000 is currently configured to represent "Generate new LCID".
const LIFECYCLE_ID_SELECTION_GENERATE_NEW = 216640000;

function onLifecycleIDSelectionChange(executionContext) {
  const formContext = executionContext.getFormContext();

  const lifecycleIdSelection = formContext
    .getAttribute("cr3ee_lifecycleid")
    ?.getValue();
  if (lifecycleIdSelection === LIFECYCLE_ID_SELECTION_GENERATE_NEW) {
    //Generate new LCID
    setVisible(formContext, "cr3ee_lcid", false);
    setRequired(formContext, "cr3ee_lcid", false);

    setVisible(formContext, "cr3ee_expirationdate", true);
    setRequired(formContext, "cr3ee_expirationdate", true);

    setVisible(formContext, "cr3ee_scopeofthelifecycleid", true);
  } else {
    //Use existing LCID
    setRequired(formContext, "cr3ee_lcid", true);
    setVisible(formContext, "cr3ee_lcid", true);

    setVisible(formContext, "cr3ee_expirationdate", false);
    setRequired(formContext, "cr3ee_expirationdate", false);

    setVisible(formContext, "cr3ee_scopeofthelifecycleid", false);
  }
}

function applyRules(formContext) {
  const activityType = formContext
    .getAttribute("cr3ee_activitytype")
    ?.getValue();
  const rules = TYPE_RULES[activityType];

  // Reset all managed required fields to not required
  ALL_FIELDS.forEach((fieldName) => setRequired(formContext, fieldName, false));

  // Default: hide everything until we know the type (optional)
  // If you prefer "do nothing until chosen", replace this with a return when !rules.
  if (!rules) {
    // If activity type isn't selected yet, keep things simple:
    // show only the type field and any always-visible notes fields if you want.
    ALL_FIELDS.forEach((fieldName) =>
      setVisible(formContext, fieldName, false),
    );
    // Show a couple common fields (optional):
    setVisible(formContext, "new_additionalinformation", true);
    setVisible(formContext, "new_adminnote", true);
    return;
  }

  // Start from a known state: hide everything…
  ALL_FIELDS.forEach((fieldName) => setVisible(formContext, fieldName, false));

  // …then show what this type wants shown
  (rules.show || []).forEach((f) => setVisible(formContext, f, true));

  // Require fields (also make sure they’re visible)
  (rules.require || []).forEach((f) => {
    setVisible(formContext, f, true);
    setRequired(formContext, f, true);
  });

  // Explicit hides (overrides show/require if you fat-finger config)
  (rules.hide || []).forEach((f) => {
    setRequired(formContext, f, false);
    setVisible(formContext, f, false);
  });

  setActivityLogTitle(formContext, ACTIVITY_TITLES[activityType]);
}

function setVisible(formContext, logicalName, visible) {
  const ctrl = formContext.getControl(logicalName);
  if (!ctrl) return; // quick create may not include the field
  ctrl.setVisible(visible);
}

function setRequired(formContext, logicalName, required) {
  const attr = formContext.getAttribute(logicalName);
  if (!attr) return;
  attr.setRequiredLevel(required ? "required" : "none");
}

function setActivityLogTitle(formContext, title) {
  formContext.getAttribute("new_activity")?.setValue(title);

  const header =
    parent.document.querySelector("[data-id='quickHeaderTitle']") ||
    document.querySelector("[data-id='quickHeaderTitle']");
  if (header) {
    header.textContent = title;
  } else {
    console.log("header not found?");
  }

  if (formContext.getAttribute("new_activity")) {
    formContext.getAttribute("new_activity")?.setValue(title);
  } else {
    console.log("could not find Activity");
  }
}
