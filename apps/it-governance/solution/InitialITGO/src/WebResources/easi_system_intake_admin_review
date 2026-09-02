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
  const tab = formContext.ui.tabs.get("tab_request_home");
  const trackerSection = tab?.sections.get("section_progress_tracker");
  if (!trackerSection) {
    if (attempt < 20) {
      setTimeout(() => updateProgressTracker(formContext, attempt + 1), 300);
    }
    return;
  }
  if (!trackerSection?.getVisible()) {
    if (attempt < 20) {
      setTimeout(() => updateProgressTracker(formContext, attempt + 1), 300);
    }
    return;
  }

  const statusValue = formContext
    .getAttribute("new_admingovernancetasklist")
    ?.getValue();

  const webResourceControl = formContext.getControl(
    "WebResource_progress_tracker",
  );
  if (!webResourceControl || !statusValue) {
    if (attempt < 20) {
      setTimeout(() => updateProgressTracker(formContext, attempt + 1), 300);
    }
    return;
  }

  webResourceControl.getContentWindow().then(
    (contentWindow) => {
      if (typeof contentWindow.updateProgress === "function") {
        contentWindow.updateProgress(statusValue);
      }
      if (typeof contentWindow.refreshProgressTracker === "function") {
        contentWindow.refreshProgressTracker();
      } else if (attempt < 20) {
        setTimeout(() => updateProgressTracker(formContext, attempt + 1), 300);
      }
    },
    () => {
      if (attempt < 20) {
        setTimeout(() => updateProgressTracker(formContext, attempt + 1), 300);
      }
    },
  );
}
