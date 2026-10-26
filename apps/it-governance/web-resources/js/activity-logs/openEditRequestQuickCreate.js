(function () {
  const REQUEST_ENTITY = "new_systemintake";
  const REVIEW_ENTITY = "cr69a_systemintakeadmin";
  const EDIT_REQUEST_ENTITY = "cr69a_editrequest";

  async function resolveEditRequestContext(formContext) {
    const entityName = formContext?.data?.entity?.getEntityName?.();
    const recordId = (formContext?.data?.entity?.getId?.() || "").replace(
      /[{}]/g,
      "",
    );
    const recordName =
      formContext?.data?.entity?.getPrimaryAttributeValue?.() || "";

    if (!recordId) {
      await Xrm.Navigation.openAlertDialog({
        text: "Save the record before creating an Edit Request.",
      });
      return null;
    }

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
          text: "More than one Review is associated with this Request. Resolve the duplicate Reviews before creating an Edit Request.",
        });
        return null;
      }

      return {
        reviewId: reviews[0].cr69a_systemintakeadminid,
        reviewName: reviews[0].cr69a_title || "Review",
        requestId: recordId,
        requestName: recordName || "Request",
      };
    }

    await Xrm.Navigation.openAlertDialog({
      text: "Edit Requests can be created only from Request and Review forms.",
    });
    return null;
  }

  async function openEditRequestQuickCreate(primaryControl) {
    const formContext = primaryControl?.getFormContext?.() || primaryControl;

    try {
      const context = await resolveEditRequestContext(formContext);
      if (!context) return;

      const parameters = {
        cr69a_systemintakeadmin: context.reviewId,
        cr69a_systemintakeadminname: context.reviewName,
        cr69a_systemintakeadmintype: REVIEW_ENTITY,
        cr69a_systemintake: context.requestId,
        cr69a_systemintakename: context.requestName,
        cr69a_systemintaketype: REQUEST_ENTITY,
      };

      const result = await Xrm.Navigation.openForm(
        {
          entityName: EDIT_REQUEST_ENTITY,
          useQuickCreateForm: true,
        },
        parameters,
      );

      if (result?.savedEntityReference) {
        if (!formContext.data.entity.getIsDirty?.()) {
          await formContext.data.refresh(false);
        }
      }
    } catch (error) {
      console.error("Failed to open the Edit Request Quick Create form:", error);

      await Xrm.Navigation.openAlertDialog({
        text: "Something went wrong opening the Edit Request Quick Create form.",
      });

      throw error;
    }
  }

  window.openEditRequestQuickCreate = openEditRequestQuickCreate;
})();
