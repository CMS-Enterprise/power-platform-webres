// This same script is used by the Actions commands on Requests and Reviews.

(function () {
  const REQUEST_ENTITY = "new_systemintake";
  const REVIEW_ENTITY = "cr69a_systemintakeadmin";

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
    const formContext = primaryControl?.getFormContext?.() || primaryControl;
    const recordIdRaw = formContext?.data?.entity?.getId();

    if (!recordIdRaw) {
      await Xrm.Navigation.openAlertDialog({
        text: "Save the Request before using an Actions command.",
      });
      return;
    }

    try {
      const actionContext = await resolveActionContext(formContext);
      if (!actionContext) return;

      const { reviewId, reviewName, requestId, requestName } = actionContext;

      const ctx = Xrm.Utility.getGlobalContext();
      const currentUserId = (ctx.userSettings.userId || "").replace(
        /[{}]/g,
        "",
      );
      const currentUserName = ctx.userSettings.userName || "Current User";

      // NOTE: Parameter names must match your Activity Log lookup schema names
      const parameters = {
        // Prefill parent lookups
        new_adminreview: reviewId,
        new_adminreviewname: reviewName,
        new_adminreviewtype: REVIEW_ENTITY,

        new_systemintake: requestId,
        new_systemintakename: requestName,
        new_systemintaketype: REQUEST_ENTITY,

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
      const parentHasUnsavedChanges =
        formContext.data.entity.getIsDirty?.() || false;

      // Refresh after the quick create closes so the host form picks up any
      // side effects. If the dialog was canceled and the parent form is dirty,
      // skip refresh(false) so unsaved parent edits are not discarded.
      console.log(
        "[openActivityLogQuickCreate] quick create closed, refreshing parent form",
        {
          savedEntityReference: result?.savedEntityReference || null,
          saveParentBeforeRefresh,
          parentHasUnsavedChanges,
        },
      );
      if (!saveParentBeforeRefresh && parentHasUnsavedChanges) {
        console.log(
          "[openActivityLogQuickCreate] skipping parent refresh because quick create did not save and parent form has unsaved changes",
        );
        return;
      }

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

  async function resolveActionContext(formContext) {
    const entityName = formContext?.data?.entity?.getEntityName?.();
    const recordId = (formContext?.data?.entity?.getId?.() || "").replace(
      /[{}]/g,
      "",
    );
    const recordName =
      formContext?.data?.entity?.getPrimaryAttributeValue?.() || "";

    if (entityName === REVIEW_ENTITY) {
      const review = await Xrm.WebApi.retrieveRecord(
        REVIEW_ENTITY,
        recordId,
        "?$select=cr69a_title,_cr69a_systemintake_value",
      );
      const requestId = review?._cr69a_systemintake_value;

      if (!requestId) {
        await Xrm.Navigation.openAlertDialog({
          text: "This Review is not associated with a Request.",
        });
        return null;
      }

      return {
        reviewId: recordId,
        reviewName: review.cr69a_title || recordName || "Review",
        requestId,
        requestName:
          review[
            "_cr69a_systemintake_value@OData.Community.Display.V1.FormattedValue"
          ] || "Request",
      };
    }

    if (entityName === REQUEST_ENTITY) {
      const query =
        "?$select=cr69a_systemintakeadminid,cr69a_title" +
        `&$filter=_cr69a_systemintake_value eq ${recordId}` +
        "&$orderby=createdon desc&$top=2";
      const result = await Xrm.WebApi.retrieveMultipleRecords(
        REVIEW_ENTITY,
        query,
      );
      const reviews = result?.entities || [];

      if (reviews.length === 0) {
        await Xrm.Navigation.openAlertDialog({
          text: "No Review is associated with this Request.",
        });
        return null;
      }

      if (reviews.length > 1) {
        await Xrm.Navigation.openAlertDialog({
          text: "More than one Review is associated with this Request. Resolve the duplicate Reviews before taking an action.",
        });
        return null;
      }

      const review = reviews[0];
      return {
        reviewId: review.cr69a_systemintakeadminid,
        reviewName: review.cr69a_title || "Review",
        requestId: recordId,
        requestName: recordName || "Request",
      };
    }

    await Xrm.Navigation.openAlertDialog({
      text: "Actions commands are supported only on Request and Review forms.",
    });
    return null;
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
