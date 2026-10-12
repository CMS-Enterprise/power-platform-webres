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

var SOLUTION_TYPE_PREFERRED = 971270000;
var SOLUTIONS_REQUIRED_MESSAGE =
  "Please add at least one Preferred Solution and one Alternative Solution.";

function updateSolutionsNotification(formContext, gridControl) {
  var notificationId = "solutions_required";
  var grid = gridControl.getGrid();

  if (!grid) {
    formContext.ui.setFormNotification(
      SOLUTIONS_REQUIRED_MESSAGE,
      "INFO",
      notificationId,
    );
    return;
  }

  var hasPreferred = false;
  var hasAlternative = false;

  grid.getRows().forEach(function (row) {
    var solutionType = row
      .getData()
      .getEntity()
      .attributes.get("cr69a_solution_type");
    var value = solutionType ? solutionType.getValue() : null;

    // Grid option set values can come back as strings, so compare as numbers
    if (value !== null && Number(value) === SOLUTION_TYPE_PREFERRED) {
      hasPreferred = true;
    } else {
      hasAlternative = true;
    }
  });

  if (hasPreferred && hasAlternative) {
    formContext.ui.clearFormNotification(notificationId);
  } else {
    formContext.ui.setFormNotification(
      SOLUTIONS_REQUIRED_MESSAGE,
      "ERROR",
      notificationId,
    );
  }
}
