function openCustomPage(primaryControl, selectedIds) {
  // Works on both grids and forms
  // GRID:  primaryControl is a grid control; use selection
  // FORM:  primaryControl is a form context; use getId/getEntityName

  var entityName, id;

  if (primaryControl && primaryControl.getEntityName) {
    // On a GRID
    entityName = primaryControl.getEntityName();
    var ids =
      (primaryControl.getSelection &&
        primaryControl.getSelection().getSelectedIds &&
        primaryControl.getSelection().getSelectedIds()) ||
      selectedIds ||
      [];
    if (!ids || ids.length !== 1) {
      Xrm.Navigation.openAlertDialog({
        text: "Please select exactly one row.",
      });
      return;
    }
    id = ids[0];
  } else if (
    primaryControl &&
    primaryControl.data &&
    primaryControl.data.entity
  ) {
    // On a FORM (legacy api shape)
    entityName = primaryControl.data.entity.getEntityName();
    id = primaryControl.data.entity.getId();
  } else if (primaryControl && primaryControl.getFormContext) {
    // On a FORM (modern api shape)
    var formCtx = primaryControl.getFormContext();
    entityName = formCtx.data.entity.getEntityName();
    id = formCtx.data.entity.getId();
  } else {
    Xrm.Navigation.openAlertDialog({
      text: "Could not determine record context.",
    });
    return;
  }

  var cleanId = (id || "").replace(/[{}]/g, "");

  Xrm.Navigation.navigateTo(
    {
      pageType: "custom",
      name: "cr69a_systemintakeadmintools_0f36a", // your custom page unique name
        recordId: cleanId,
        entityName: entityName,
    },
    {
      target: 2, // modal
      width: { value: 80, unit: "%" },
      height: { value: 80, unit: "%" },
    }
  );
}
