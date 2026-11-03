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
  updateSolutionsNotification(formContext);

  // Re-check every time the subgrid refreshes (solution added/edited/removed)
  gridControl.addOnLoad(function () {
    updateSolutionsNotification(formContext);
  });
}

var SOLUTION_TYPE_PREFERRED = 971270000;
var SOLUTIONS_REQUIRED_MESSAGE =
  "Please add at least one Preferred Solution and one Alternative Solution.";

// Solutions link to the parent through a different lookup depending on
// whether this script runs on the Request or Business Case form.
var SOLUTION_PARENT_LOOKUPS = {
  new_systemintake: "_new_request_value",
  cr69a_businesscase: "_easi_cr69a_businesscase_value",
};

// Incremented on every check so a slow response from an earlier refresh
// can't overwrite the result of a newer one.
var solutionsCheckSequence = 0;

// Query Dataverse rather than reading the subgrid, which only exposes the
// current page of rows and depends on the view's columns.
function updateSolutionsNotification(formContext) {
  var notificationId = "solutions_required";
  var checkId = ++solutionsCheckSequence;
  var parentId = formContext.data.entity.getId().replace(/[{}]/g, "");
  var parentLookup =
    SOLUTION_PARENT_LOOKUPS[formContext.data.entity.getEntityName()];

  if (!parentLookup) {
    return;
  }

  Xrm.WebApi.retrieveMultipleRecords(
    "cr69a_businesscasesolution",
    "?$select=cr69a_solution_type" +
      "&$filter=" +
      parentLookup +
      " eq " +
      parentId +
      " and statecode eq 0",
  ).then(
    function (result) {
      if (checkId !== solutionsCheckSequence) {
        return;
      }

      var hasPreferred = false;
      var hasAlternative = false;

      result.entities.forEach(function (solution) {
        if (solution.cr69a_solution_type === SOLUTION_TYPE_PREFERRED) {
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
    },
    function (error) {
      if (checkId !== solutionsCheckSequence) {
        return;
      }

      console.error("[businessCase] failed to retrieve solutions", error);
      formContext.ui.setFormNotification(
        SOLUTIONS_REQUIRED_MESSAGE,
        "INFO",
        notificationId,
      );
    },
  );
}
