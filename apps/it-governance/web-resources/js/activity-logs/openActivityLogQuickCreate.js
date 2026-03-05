//this same script is used in all of the Actions in a Review

(function () {
  const ACTIVITY_TYPES = {
    ProgressToNewStep: 216640000,
    IssueALifeCycleID: 216640001,
    NotAnITGovernanceRequest: 216640002,
    NotApprovedByGRB: 216640003,
    CloseRequest: 216640004,
    EditRequest: 216640005, //not used in this context
    ReOpenRequest: 216640006,
  };

  async function openActivityLogQuickCreate(
    primaryControl,
    activityTypeValue,
    extraParams = {},
  ) {
    const formContext = primaryControl;
    const parentEntityName = "cr69a_systemintakeadmin";
    const parentIdRaw = formContext?.data?.entity?.getId();

    if (!parentIdRaw) {
      await Xrm.Navigation.openAlertDialog({
        text: "No parent record id found.",
      });
      return;
    }

    try {
      const parentId = parentIdRaw.replace(/[{}]/g, "");
      const parentName =
        formContext.data.entity.getPrimaryAttributeValue?.() || "Admin Review";

      // Pull related System Intake if you need it
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

      const ctx = Xrm.Utility.getGlobalContext();
      const currentUserId = (ctx.userSettings.userId || "").replace(
        /[{}]/g,
        "",
      );
      const currentUserName = ctx.userSettings.userName || "Current User";

      // NOTE: Parameter names must match your Activity Log lookup schema names
      const parameters = {
        // Prefill parent lookups
        new_adminreview: parentId,
        new_adminreviewname: parentName,
        new_adminreviewtype: parentEntityName,

        ...(systemIntakeId
          ? {
              new_systemintake: systemIntakeId,
              new_systemintakename: systemIntakeName || "System Intake",
              new_systemintaketype: "new_systemintake",
            }
          : {}),

        // Prefill "Activity By" (user lookup)
        new_activityby: currentUserId,
        new_activitybyname: currentUserName,
        new_activitybytype: "systemuser",

        // Prefill date/time
        new_activityon: new Date(),

        cr3ee_activitytype: activityTypeValue,

        // Allow per-button overrides
        ...extraParams,
      };

      const formOptions = {
        entityName: "new_activitylogs",
        useQuickCreateForm: true,
      };

      const result = await Xrm.Navigation.openForm(formOptions, parameters);

      if (result?.savedEntityReference) {
        await formContext.data.refresh(true);
      }
    } catch (error) {
      const message =
        "An error occurred while opening the Activity Log quick create form. Please try again or contact your system administrator.";

      await (Xrm?.Navigation?.openErrorDialog
        ? Xrm.Navigation.openErrorDialog({
            message,
            details:
              (error && (error.message || error.toString())) || undefined,
          })
        : Xrm.Navigation.openAlertDialog({ text: message }));
    }
  }

  window.ITGov_ProgressToNewStep = function (primaryControl) {
    return openActivityLogQuickCreate(
      primaryControl,
      ACTIVITY_TYPES.ProgressToNewStep,
    );
  };
  window.ITGov_IssueALifeCycleID = function (primaryControl) {
    return openActivityLogQuickCreate(
      primaryControl,
      ACTIVITY_TYPES.IssueALifeCycleID,
    );
  };
  window.ITGov_NotAnITGovernanceRequest = function (primaryControl) {
    return openActivityLogQuickCreate(
      primaryControl,
      ACTIVITY_TYPES.NotAnITGovernanceRequest,
    );
  };
  window.ITGov_NotApprovedByGRB = function (primaryControl) {
    return openActivityLogQuickCreate(
      primaryControl,
      ACTIVITY_TYPES.NotApprovedByGRB,
    );
  };
  window.ITGov_CloseRequest = function (primaryControl) {
    return openActivityLogQuickCreate(
      primaryControl,
      ACTIVITY_TYPES.CloseRequest,
    );
  };
  window.ITGov_ReOpenRequest = function (primaryControl) {
    return openActivityLogQuickCreate(
      primaryControl,
      ACTIVITY_TYPES.ReOpenRequest,
    );
  };
})();
