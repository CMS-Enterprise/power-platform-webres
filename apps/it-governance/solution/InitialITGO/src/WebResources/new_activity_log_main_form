const ACTIVITY_TYPES = {
  ProgressToNewStep: 216640000,
  IssueALifeCycleID: 216640001,
  NotAnITGovernanceRequest: 216640002,
  NotApprovedByGRB: 216640003,
  CloseRequest: 216640004,
  EditRequest: 216640005,
  ReopenRequest: 216640006,
};

const ALL_SECTIONS = [
  "section_reopen_request",
  "section_close_request",
  "section_not_approved_by_grb",
  "section_not_an_it_gov_request",
  "section_issue_lcid",
  "section_progress_to_a_new_step",
  "section_request_edits",
];

const TYPE_TO_SECTIONS = {
  [ACTIVITY_TYPES.ProgressToNewStep]: ["section_progress_to_a_new_step"],
  [ACTIVITY_TYPES.IssueALifeCycleID]: ["section_issue_lcid"],
  [ACTIVITY_TYPES.NotAnITGovernanceRequest]: ["section_not_an_it_gov_request"],
  [ACTIVITY_TYPES.NotApprovedByGRB]: ["section_not_approved_by_grb"],
  [ACTIVITY_TYPES.CloseRequest]: ["section_close_request"],
  [ACTIVITY_TYPES.EditRequest]: ["section_request_edits"],
  [ACTIVITY_TYPES.ReopenRequest]: ["section_reopen_request"],
};

const TAB_NAME = "General";
const ACTIVITY_TYPE_FIELD = "cr3ee_activitytype";

function OnLoad(executionContext) {
  console.log("firing on load");
  const formContext = executionContext.getFormContext();
  showHideActivitySections(formContext);
}

function showHideActivitySections(formContext) {
  console.log("firing showhideactivitysections");
  const tab = formContext.ui.tabs.get(TAB_NAME);
  if (!tab) {
    console.warn(`Tab not found: ${TAB_NAME}`);
    return;
  }

  const activityType = formContext
    .getAttribute(ACTIVITY_TYPE_FIELD)
    ?.getValue();

  console.log("activityType", activityType);
  const visibleSections = new Set(TYPE_TO_SECTIONS[activityType] || []);

  ALL_SECTIONS.forEach((sectionName) => {
    const section = tab.sections.get(sectionName);
    if (!section) {
      console.warn(`Section not found: ${sectionName}`);
      return;
    }

    section.setVisible(visibleSections.has(sectionName));
  });
}
