async function openActivityLogQuickCreate(primaryControl) {
  const formContext = primaryControl;
  const parentEntityName = "cr69a_systemintakeadmin";
  const parentIdRaw = formContext?.data?.entity?.getId();

  if (!parentIdRaw) {
    await Xrm.Navigation.openAlertDialog({
      text: "No parent record id found.",
    });
    return;
  }

  const parentId = parentIdRaw.replace(/[{}]/g, "");
  const parentName =
    formContext.data.entity.getPrimaryAttributeValue?.() || "Admin Review";

  const parent = await Xrm.WebApi.retrieveRecord(
    parentEntityName,
    parentId,
    "?$select=_cr69a_systemintake_value",
  );

  const systemIntakeId = parent?._cr69a_systemintake_value;
  const systemIntakeName =
    parent?.[
      "_cr69a_systemintake_value@OData.Community.Display.V1.FormattedValue"
    ];

  const parameters = {
    new_adminreview: parentId,
    new_adminreviewname: parentName,
    new_adminreviewtype: parentEntityName,
  };

  if (systemIntakeId) {
    parameters.new_systemintake = systemIntakeId;
    parameters.new_systemintakename = systemIntakeName || "System Intake";
    parameters.new_systemintaketype = "new_systemintake";
  }

  // ✅ Prefill Activity By (current user)
  const ctx = Xrm.Utility.getGlobalContext();
  const currentUserId = (ctx.userSettings.userId || "").replace(/[{}]/g, "");
  const currentUserName = ctx.userSettings.userName || "Current User";

  parameters.new_activityby = currentUserId;
  parameters.new_activitybyname = currentUserName;
  parameters.new_activitybytype = "systemuser";

  parameters.new_activityon = new Date();

  const formOptions = {
    entityName: "new_activitylogs",
    useQuickCreateForm: true,
  };

  const result = await Xrm.Navigation.openForm(formOptions, parameters);

  if (result && result.savedEntityReference) {
    await formContext.data.refresh(true);
  }
}
