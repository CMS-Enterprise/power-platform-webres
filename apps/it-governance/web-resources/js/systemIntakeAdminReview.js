function onLoad(executionContext) {
  onDecisionChange(executionContext);
  LcidFieldHandler(executionContext);
  onLCIDTypeChange(executionContext);
}

function onSave(executionContext) {
  const formContext = executionContext.getFormContext();
  const COL_LCID_REQUESTED = "cr69a_lcidrequested"; // Two options / Boolean
  const COL_LCID_REQUESTED_ON = "cr69a_lcidrequestedon"; // DateTime
  const COL_LCID_REQUESTED_BY = "cr69a_lcidrequestedby"; // Lookup -> systemuser

  if (
    formContext.getAttribute(COL_LCID_REQUESTED) &&
    formContext.getAttribute(COL_LCID_REQUESTED).getValue()
  ) {
    try {
      if (!formContext) {
        setStatus(
          "Unable to access the form. Please refresh and try again.",
          true
        );
        return;
      }

      // Ensure the columns are on the form (even if hidden)
      const aRequested = formContext.getAttribute(COL_LCID_REQUESTED);
      const aRequestedOn = formContext.getAttribute(COL_LCID_REQUESTED_ON);
      const aRequestedBy = formContext.getAttribute(COL_LCID_REQUESTED_BY);

      if (!aRequested || !aRequestedOn || !aRequestedBy) {
        console.error("Unexpected error:", e);
        return;
      }

      // Set values
      aRequested.setValue(true);
      aRequestedOn.setValue(new Date());

      // Lookup value needs [{ id: '{GUID}', name: 'Display Name', entityType: 'systemuser' }]
      const user = parent.Xrm.Utility.getGlobalContext().userSettings;
      const userIdWithBraces = `{${user.userId.replace(/[{}]/g, "")}}`;
      aRequestedBy.setValue([
        {
          id: userIdWithBraces,
          name: user.userName || user.userId,
          entityType: "systemuser",
        },
      ]);
    } catch (e) {
      console.error("Unexpected error:", e);
    }
  }
}

function showHideSections(formContext, fields) {
  for (var key in fields) {
    const section = formContext.ui.tabs.get("General").sections.get(key);
    if (section) {
      section.setVisible(fields[key]);
    } else {
      console.error(`Section not found: ${key}`);
    }
  }
}

function LcidFieldHandler(executionContext) {
  const formContext = executionContext.getFormContext();
  const lcid = formContext.getAttribute("cr69a_lcid").getValue();

  // if (lcid) {
  //   const fieldsToLock = [
  //     "cr69a_lifecycleid",
  //     "cr69a_lcidexpirationdate",
  //     "cr69a_scopeoflifecycleid",
  //     "cr69a_lcidnextsteps",
  //     "cr69a_shouldthisteamconsultwiththetrb",
  //     "cr69a_lcidprojectcostbaseline",
  //     "cr69a_lcidadditionalinformation",
  //     "cr69a_adminnoteoptional",
  //   ];

  //   fieldsToLock.forEach((fieldName) => {
  //     const control = formContext.getControl(fieldName);
  //     if (control) {
  //       control.setDisabled(true);
  //     }
  //   });
  // }
}

function onDecisionChange(executionContext) {
  const formContext = executionContext.getFormContext();
  const decisionValue = formContext.getAttribute("cr69a_decision").getValue();

  if (!decisionValue) {
    return;
  }

  const sections = {
    section_lifecycle_id: false,
    section_not_an_it_gov_request: false,
    section_not_approved_by_grb: false,
    section_close_request: false,
    section_issue_LCID: false,
    section_lcid: false,
    section_next_steps: false,
  };

  //section_lifecycle_id
  if (decisionValue === 971270000) {
    sections.section_lifecycle_id = true;

    sections.section_issue_LCID = true;
    sections.section_lcid = true;
    sections.section_next_steps = true;

    //section_not_an_it_gov_request
  } else if (decisionValue === 971270001) {
    sections.section_not_an_it_gov_request = true;
    //section_not_approved_by_grb
  } else if (decisionValue === 971270002) {
    sections.section_not_approved_by_grb = true;
    //section_close_request
  } else if (decisionValue === 971270003) {
    sections.section_close_request = true;
  } else {
    console.error("Error: Something went wrong showing Decision sections.");
  }
  showHideSections(formContext, sections);
}

function onLCIDTypeChange(executionContext) {
  const formContext = executionContext.getFormContext();

  const lcidTypeValue = formContext
    .getAttribute("cr69a_lifecycleid")
    .getValue();

  const lcid = formContext.getAttribute("cr69a_lcid").getValue();

  if (lcid) {
    formContext.getControl("cr69a_lcid").setVisible(true);
    formContext.getControl("cr69a_lcidrequested").setVisible(true);
    formContext.getControl("cr69a_lcidrequestedon").setVisible(true);
    formContext.getControl("cr69a_lcidrequestedby").setVisible(true);

    formContext.getControl("cr69a_lifecycleid").setDisabled(true);
    formContext.getControl("cr69a_decision").setDisabled(true);

    formContext.getControl("cr69a_lcidexpirationdate").setDisabled(true);
    formContext.getControl("cr69a_lcidexpirationdate").setVisible(true);

    formContext.getControl("cr69a_scopeoflifecycleid").setDisabled(true);
    formContext.getControl("cr69a_scopeoflifecycleid").setVisible(true);

    formContext.getControl("WebResource_issue_lcid_button").setVisible(false);
    return;
  }

  formContext.getControl("cr69a_lifecycleid").setDisabled(false);

  if (!lcidTypeValue) {
    formContext.getControl("cr69a_lcid").setVisible(false);
    return;
  } else if (lcidTypeValue === 971270000) {
    //Generate a new Life Cycle ID
    formContext.getControl("cr69a_lcid").setVisible(false);
    formContext.getControl("cr69a_lcid").setDisabled(true);

    formContext.getControl("cr69a_lcidexpirationdate").setVisible(true);
    formContext.getControl("cr69a_scopeoflifecycleid").setVisible(true);

    formContext.getControl("cr69a_lcidrequested").setVisible(true);
    formContext.getControl("cr69a_lcidrequestedon").setVisible(true);
    formContext.getControl("cr69a_lcidrequestedby").setVisible(true);
    formContext.getControl("WebResource_issue_lcid_button").setVisible(true);
  } else if (lcidTypeValue === 971270001) {
    //Use an existing Life Cycle ID
    formContext.getControl("cr69a_lcid").setVisible(true);
    formContext.getControl("cr69a_lcid").setDisabled(false);
    formContext.getControl("cr69a_lcidexpirationdate").setVisible(false);
    formContext.getControl("cr69a_scopeoflifecycleid").setVisible(false);

    formContext.getControl("cr69a_lcidrequested").setVisible(false);
    formContext.getControl("cr69a_lcidrequestedon").setVisible(false);
    formContext.getControl("cr69a_lcidrequestedby").setVisible(false);

    formContext.getControl("WebResource_issue_lcid_button").setVisible(false);
  }
}
