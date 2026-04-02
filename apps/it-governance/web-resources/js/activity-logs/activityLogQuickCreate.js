const GRT_MEETING_DATE_FIELD = "new_grtmeetingdate";
const GRB_REVIEW_MEETING_DATE_FIELD = "new_grbreviewmeetingdate";

// new_process_target_step option-set values
const PROCESS_TARGET_STEP_GRT_MEETING = 971270002;
const PROCESS_TARGET_STEP_GRB_REVIEW_MEETING = 971270004;

const ACTIVITY_TYPES = {
  ProgressToNewStep: 216640000,
  IssueALifeCycleID: 216640001,
  NotAnITGovernanceRequest: 216640002,
  NotApprovedByGRB: 216640003,
  CloseRequest: 216640004,
  EditRequest: 216640005, // not used in this context; separate quick create
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

// cr3ee_lifecycleid option-set values
// 216640000 = Generate new LCID
const LIFECYCLE_ID_SELECTION_GENERATE_NEW = 216640000;

// All fields managed by the quick create rules
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
  GRT_MEETING_DATE_FIELD,
  GRB_REVIEW_MEETING_DATE_FIELD,
];

// Config per activity type
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
      GRT_MEETING_DATE_FIELD,
      GRB_REVIEW_MEETING_DATE_FIELD,
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
      GRT_MEETING_DATE_FIELD,
      GRB_REVIEW_MEETING_DATE_FIELD,
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
      GRT_MEETING_DATE_FIELD,
      GRB_REVIEW_MEETING_DATE_FIELD,
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
      GRT_MEETING_DATE_FIELD,
      GRB_REVIEW_MEETING_DATE_FIELD,
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
      GRT_MEETING_DATE_FIELD,
      GRB_REVIEW_MEETING_DATE_FIELD,
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
      GRT_MEETING_DATE_FIELD,
      GRB_REVIEW_MEETING_DATE_FIELD,
    ],
    require: [],
  },
};

function onLoad(executionContext) {
  const formContext = executionContext.getFormContext();

  applyRules(formContext);
  updateProcessTargetStepVisibility(formContext);
  updateLifecycleIdSelectionVisibility(formContext);
}

function onActivityTypeChange(executionContext) {
  const formContext = executionContext.getFormContext();

  applyRules(formContext);
  updateProcessTargetStepVisibility(formContext);
  updateLifecycleIdSelectionVisibility(formContext);
}

function onProcessTargetStepChange(executionContext) {
  const formContext = executionContext.getFormContext();

  updateProcessTargetStepVisibility(formContext);
  updateProgressToNewStepTitle(formContext);
}

function onLifecycleIDSelectionChange(executionContext) {
  const formContext = executionContext.getFormContext();
  updateLifecycleIdSelectionVisibility(formContext);
}

function updateLifecycleIdSelectionVisibility(formContext) {
  const activityType = formContext
    .getAttribute("cr3ee_activitytype")
    ?.getValue();

  // Only manage these fields for Issue a Life Cycle ID
  if (activityType !== ACTIVITY_TYPES.IssueALifeCycleID) {
    setVisible(formContext, "cr3ee_lcid", false);
    setRequired(formContext, "cr3ee_lcid", false);
    clearValue(formContext, "cr3ee_lcid");

    setVisible(formContext, "cr3ee_expirationdate", false);
    setRequired(formContext, "cr3ee_expirationdate", false);
    clearValue(formContext, "cr3ee_expirationdate");

    setVisible(formContext, "cr3ee_scopeofthelifecycleid", false);
    clearValue(formContext, "cr3ee_scopeofthelifecycleid");

    return;
  }

  const lifecycleIdSelection = formContext
    .getAttribute("cr3ee_lifecycleid")
    ?.getValue();

  if (lifecycleIdSelection === LIFECYCLE_ID_SELECTION_GENERATE_NEW) {
    // Generate new LCID
    setVisible(formContext, "cr3ee_lcid", false);
    setRequired(formContext, "cr3ee_lcid", false);
    clearValue(formContext, "cr3ee_lcid");

    setVisible(formContext, "cr3ee_expirationdate", true);
    setRequired(formContext, "cr3ee_expirationdate", true);

    setVisible(formContext, "cr3ee_scopeofthelifecycleid", true);
  } else {
    // Use existing LCID
    setVisible(formContext, "cr3ee_lcid", true);
    setRequired(formContext, "cr3ee_lcid", true);

    setVisible(formContext, "cr3ee_expirationdate", false);
    setRequired(formContext, "cr3ee_expirationdate", false);
    clearValue(formContext, "cr3ee_expirationdate");

    setVisible(formContext, "cr3ee_scopeofthelifecycleid", false);
    clearValue(formContext, "cr3ee_scopeofthelifecycleid");
  }
}

function updateProcessTargetStepVisibility(formContext) {
  const stepValue = formContext
    .getAttribute("new_process_target_step")
    ?.getValue();

  const grtDateAttr = formContext.getAttribute(GRT_MEETING_DATE_FIELD);
  const grbReviewDateAttr = formContext.getAttribute(
    GRB_REVIEW_MEETING_DATE_FIELD,
  );

  setVisible(formContext, GRT_MEETING_DATE_FIELD, false);
  setVisible(formContext, GRB_REVIEW_MEETING_DATE_FIELD, false);

  if (stepValue === PROCESS_TARGET_STEP_GRT_MEETING) {
    setVisible(formContext, GRT_MEETING_DATE_FIELD, true);

    if (grbReviewDateAttr) {
      grbReviewDateAttr.setValue(null);
    }
  } else if (stepValue === PROCESS_TARGET_STEP_GRB_REVIEW_MEETING) {
    setVisible(formContext, GRB_REVIEW_MEETING_DATE_FIELD, true);

    if (grtDateAttr) {
      grtDateAttr.setValue(null);
    }
  } else {
    if (grtDateAttr) {
      grtDateAttr.setValue(null);
    }
    if (grbReviewDateAttr) {
      grbReviewDateAttr.setValue(null);
    }
  }
}

function updateProgressToNewStepTitle(formContext) {
  const activityType = formContext
    .getAttribute("cr3ee_activitytype")
    ?.getValue();

  if (activityType !== ACTIVITY_TYPES.ProgressToNewStep) {
    return;
  }

  const stepAttr = formContext.getAttribute("new_process_target_step");
  const activityAttr = formContext.getAttribute("new_activity");

  if (!stepAttr || !activityAttr) return;

  const stepValue = stepAttr.getValue();
  if (stepValue === null || stepValue === undefined) {
    activityAttr.setValue(ACTIVITY_TITLES[ACTIVITY_TYPES.ProgressToNewStep]);
    return;
  }

  const stepText = stepAttr.getText();
  if (!stepText) {
    activityAttr.setValue(ACTIVITY_TITLES[ACTIVITY_TYPES.ProgressToNewStep]);
    return;
  }

  activityAttr.setValue("Request moved to " + stepText);
}

function applyRules(formContext) {
  const activityType = formContext
    .getAttribute("cr3ee_activitytype")
    ?.getValue();
  const rules = TYPE_RULES[activityType];

  ALL_FIELDS.forEach((fieldName) => setRequired(formContext, fieldName, false));

  if (!rules) {
    ALL_FIELDS.forEach((fieldName) =>
      setVisible(formContext, fieldName, false),
    );
    setVisible(formContext, "new_additionalinformation", true);
    setVisible(formContext, "new_adminnote", true);
    return;
  }

  ALL_FIELDS.forEach((fieldName) => setVisible(formContext, fieldName, false));

  (rules.show || []).forEach((fieldName) =>
    setVisible(formContext, fieldName, true),
  );

  (rules.require || []).forEach((fieldName) => {
    setVisible(formContext, fieldName, true);
    setRequired(formContext, fieldName, true);
  });

  (rules.hide || []).forEach((fieldName) => {
    setRequired(formContext, fieldName, false);
    setVisible(formContext, fieldName, false);
  });

  if (activityType === ACTIVITY_TYPES.ProgressToNewStep) {
    updateProgressToNewStepTitle(formContext);
  } else {
    setActivityLogTitle(formContext, ACTIVITY_TITLES[activityType]);
  }
}

function setVisible(formContext, logicalName, visible) {
  const ctrl = formContext.getControl(logicalName);
  if (!ctrl) return;
  ctrl.setVisible(visible);
}

function setRequired(formContext, logicalName, required) {
  const attr = formContext.getAttribute(logicalName);
  if (!attr) return;
  attr.setRequiredLevel(required ? "required" : "none");
}

function clearValue(formContext, logicalName) {
  const attr = formContext.getAttribute(logicalName);
  if (!attr) return;
  attr.setValue(null);
}

function setActivityLogTitle(formContext, title) {
  const activityAttr = formContext.getAttribute("new_activity");
  if (activityAttr) {
    activityAttr.setValue(title);
  } else {
    console.log("could not find new_activity");
  }

  const header =
    parent.document.querySelector("[data-id='quickHeaderTitle']") ||
    document.querySelector("[data-id='quickHeaderTitle']");

  if (header) {
    header.textContent = title;
  } else {
    console.log("header not found");
  }
}
