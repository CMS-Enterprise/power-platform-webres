function businessCaseOnLoad(executionContext) {
  var formContext = executionContext.getFormContext();

  // Skip brand new records
  if (formContext.ui.getFormType() === 1) {
    return;
  }

  var gridControl = formContext.getControl("subgrid_solutions");
  if (!gridControl) {
    return;
  }

  // Initial check
  updateSolutionsNotification(formContext, gridControl);

  // Re-check every time the subgrid refreshes
  gridControl.addOnLoad(function () {
    updateSolutionsNotification(formContext, gridControl);
  });
}

function updateSolutionsNotification(formContext, gridControl) {
  var notificationId = "solutions_required";
  var grid = gridControl.getGrid();

  if (!grid) {
    formContext.ui.setFormNotification(
      "Please add at least one Solution.",
      "INFO",
      notificationId,
    );
    return;
  }

  var rowCount = grid.getTotalRecordCount();

  if (rowCount > 0) {
    formContext.ui.clearFormNotification(notificationId);
  } else {
    formContext.ui.setFormNotification(
      "Please add at least one Solution.",
      "ERROR",
      notificationId,
    );
  }
}
