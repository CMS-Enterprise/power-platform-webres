// this same script is used in all of the Actions in a Review

(function () {
  const LCID_ACTIVITY_TYPES = {
    Retire: 100000000,
    Unretire: 100000001,
    Update: 100000002,
    Issue: 100000003,
    Expire: 100000004,
    Confirm: 100000005, // not used yet
    UpdateRetirementDate: 100000006,
    ExpirationAlert: 100000007, // not used in this context
  };

  function getActivityTypeLabel(activityTypeValue) {
    switch (activityTypeValue) {
      case LCID_ACTIVITY_TYPES.Retire:
        return "Retired";
      case LCID_ACTIVITY_TYPES.Unretire:
        return "Un-Retired";
      case LCID_ACTIVITY_TYPES.Update:
        return "Updated";
      case LCID_ACTIVITY_TYPES.Issue:
        return "Issued";
      case LCID_ACTIVITY_TYPES.Expire:
        return "Expired";
      case LCID_ACTIVITY_TYPES.Confirm:
        return "Confirmed";
      case LCID_ACTIVITY_TYPES.UpdateRetirementDate:
        return "Updated Retirement Date";
      case LCID_ACTIVITY_TYPES.ExpirationAlert:
        return "Expiration Alert";
      default:
        return "Activity";
    }
  }

  async function openLCIDActivityLogQuickCreate(
    primaryControl,
    activityTypeValue,
    extraParams = {},
  ) {
    const formContext = primaryControl;
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
        formContext.data.entity.getPrimaryAttributeValue?.() || "Life Cycle ID";

      const ctx = Xrm.Utility.getGlobalContext();
      const currentUserId = (ctx.userSettings.userId || "").replace(
        /[{}]/g,
        "",
      );
      const currentUserName = ctx.userSettings.userName || "Current User";

      const activityLabel = getActivityTypeLabel(activityTypeValue);
      const actionTitle = `${activityLabel} - ${parentName}`;

      const parameters = {
        // Prefill LCID lookup
        new_lcid: parentId,
        new_lcidname: parentName,
        new_lcidtype: "cr69a_lifecycleids",

        // Prefill activity fields
        new_activity: actionTitle,
        new_activitytype: activityTypeValue,
        new_action: actionTitle,

        // Prefill Activity By lookup
        new_activityby: currentUserId,
        new_activitybyname: currentUserName,
        new_activitybytype: "systemuser",

        ...extraParams,
      };

      console.log("parameters", parameters);

      const formOptions = {
        entityName: "new_lcidactivitylog",
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

  window.ITGov_RetireLCID = function (primaryControl) {
    return openLCIDActivityLogQuickCreate(
      primaryControl,
      LCID_ACTIVITY_TYPES.Retire,
    );
  };

  window.ITGov_UnretireLCID = function (primaryControl) {
    return openLCIDActivityLogQuickCreate(
      primaryControl,
      LCID_ACTIVITY_TYPES.Unretire,
    );
  };

  window.ITGov_UpdateLCID = function (primaryControl) {
    return openLCIDActivityLogQuickCreate(
      primaryControl,
      LCID_ACTIVITY_TYPES.Update,
    );
  };

  window.ITGov_ExpireLCID = function (primaryControl) {
    return openLCIDActivityLogQuickCreate(
      primaryControl,
      LCID_ACTIVITY_TYPES.Expire,
    );
  };

  window.ITGov_ConfirmLCID = function (primaryControl) {
    return openLCIDActivityLogQuickCreate(
      primaryControl,
      LCID_ACTIVITY_TYPES.Confirm,
    );
  };

  window.ITGov_UpdateRetirementDate = function (primaryControl) {
    return openLCIDActivityLogQuickCreate(
      primaryControl,
      LCID_ACTIVITY_TYPES.UpdateRetirementDate,
    );
  };
})();
