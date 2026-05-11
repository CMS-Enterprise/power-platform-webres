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

  async function refreshEmbeddedWebResources(formContext) {
    const statusValue = formContext
      ?.getAttribute?.("new_admingovernancetasklist")
      ?.getValue?.();
    const controls = formContext?.ui?.controls;

    if (!controls?.forEach) {
      return;
    }

    const refreshTasks = [];

    controls.forEach((control) => {
      if (
        !control ||
        control.getControlType?.() !== "webresource" ||
        typeof control.getContentWindow !== "function"
      ) {
        return;
      }

      refreshTasks.push(
        control.getContentWindow().then(
          (contentWindow) => {
            if (
              typeof contentWindow.updateProgress === "function" &&
              statusValue !== null &&
              statusValue !== undefined
            ) {
              console.log(
                "[openActivityLogQuickCreate] refreshing progress tracker web resource",
                {
                  controlName: control.getName?.(),
                  statusValue,
                },
              );
              contentWindow.updateProgress(statusValue);
            }

            if (typeof contentWindow.refreshReadyForReview === "function") {
              console.log(
                "[openActivityLogQuickCreate] refreshing ready-for-review web resource",
                {
                  controlName: control.getName?.(),
                },
              );
              contentWindow.refreshReadyForReview();
            }
          },
          (error) => {
            console.warn(
              "[openActivityLogQuickCreate] unable to access web resource content window",
              {
                controlName: control.getName?.(),
                error: error?.message || error,
              },
            );
          },
        ),
      );
    });

    await Promise.allSettled(refreshTasks);
  }

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

        cr3ee_activitytype: activityTypeValue,

        // Allow per-button overrides
        ...extraParams,
      };

      const formOptions = {
        entityName: "new_activitylogs",
        useQuickCreateForm: true,
      };

      const result = await Xrm.Navigation.openForm(formOptions, parameters);
      const saveParentBeforeRefresh = !!result?.savedEntityReference;

      // Refresh after the quick create closes so the host form picks up any
      // side effects even when the dialog closes without returning a saved ref.
      console.log(
        "[openActivityLogQuickCreate] quick create closed, refreshing parent form",
        {
          savedEntityReference: result?.savedEntityReference || null,
          saveParentBeforeRefresh,
        },
      );
      await formContext.data.refresh(saveParentBeforeRefresh);
      await refreshEmbeddedWebResources(formContext);
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
