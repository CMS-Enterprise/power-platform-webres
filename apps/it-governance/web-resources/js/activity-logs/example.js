const ACTIVITY_TYPES = {
  ProgressToNewStep: 216640000,
  IssueALifeCycleID: 216640001,
  NotAnITGovernanceRequest: 216640002,
  NotApprovedByGRB: 216640003,
  CloseRequest: 216640004,
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
    ],
    require: ["new_process_target_step"],
  },

  [ACTIVITY_TYPES.IssueALifeCycleID]: {
    show: [
      "cr3ee_lcid",
      "cr3ee_projectcostbaseline",
      "new_additionalinformation",
      "new_adminnote",
    ],
    hide: [
      "cr3ee_reason",
      "new_process_target_step",
      "cr3ee_whyareyouclosingthisrequest",
      "new_requester_feedback",
      "new_recommendationsforthegrb",
    ],
    require: [
      "cr3ee_lifecycleid",
      "cr3ee_expirationdate",
      "cr3ee_scopeofthelifecycleid",
      "cr3ee_trbconsult",
      "cr3ee_nextsteps",
    ],
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
