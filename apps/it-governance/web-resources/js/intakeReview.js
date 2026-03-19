function onLoad(executionContext) {
  onDecisionChange(executionContext);
  const formContext = executionContext.getFormContext();
  updateProgressTracker(formContext);
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
          true,
        );
        return;
      }

      // Ensure the columns are on the form (even if hidden)
      const aRequested = formContext.getAttribute(COL_LCID_REQUESTED);
      const aRequestedOn = formContext.getAttribute(COL_LCID_REQUESTED_ON);
      const aRequestedBy = formContext.getAttribute(COL_LCID_REQUESTED_BY);

      if (!aRequested || !aRequestedOn || !aRequestedBy) {
        console.error(
          "Either aRequested, aRequestedOn, aRequestedBy is not defined",
          "aRequested",
          aRequested,
          "aRequestedOn",
          aRequestedOn,
          "aRequestedBy",
          aRequestedBy,
        );
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

function showHideSections(formContext, tabName, fields) {
  for (var key in fields) {
    const section = formContext.ui.tabs.get(tabName).sections.get(key);
    if (section) {
      section.setVisible(fields[key]);
    } else {
      console.error(`Section not found: ${key}`);
    }
  }
}

function onDecisionChange(executionContext) {
  const formContext = executionContext.getFormContext();
  const decisionValue = formContext.getAttribute("cr69a_decision").getValue();

  if (!decisionValue) {
    return;
  }

  const sections = {
    section_lifecycle_id: false,
    section_lcid: false,
  };

  if (decisionValue === 971270000) {
    sections.section_lifecycle_id = true;
    sections.section_lcid = true;
  }
  showHideSections(formContext, "tab_decision", sections);
}

function updateProgressTracker(formContext, attempt = 0) {
  console.log("calling update progress tracker");
  const tab = formContext.ui.tabs.get("tab_request_home");
  const trackerSection = tab?.sections.get("section_progress_tracker");
  if (!trackerSection) {
    console.error("Progress Tracker Section does not exist.");
    return;
  }
  if (!trackerSection?.getVisible()) {
    console.error("Progress Tracker Section is not currently visible.");
    return;
  }

  const statusValue = formContext
    .getAttribute("new_admingovernancetasklist")
    ?.getValue();

  const webResourceControl = formContext.getControl(
    "WebResource_progress_tracker",
  );
  if (!webResourceControl || !statusValue) {
    console.error(
      "Cannot find Web Resource Control or the Admin Governance Task List field.",
    );
    return;
  }

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
