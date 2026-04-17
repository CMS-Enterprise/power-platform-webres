function onLoad(executionContext) {
  onDecisionChange(executionContext);
  const formContext = executionContext.getFormContext();
  updateProgressTracker(formContext);
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
  showHideSections(formContext, "tab_request_home", sections);
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
