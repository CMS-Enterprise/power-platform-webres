function onLoad(executionContext) {
  const formContext = executionContext.getFormContext();

  onDecisionChange(formContext);
  lockAllFields(formContext);
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

function lockAllFields(formContext) {
  if (parent.lockAllFields) {
    parent.lockAllFields(formContext);
  } else {
    console.warn("lockAllFields function not found on parent window");
  }
}
