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
