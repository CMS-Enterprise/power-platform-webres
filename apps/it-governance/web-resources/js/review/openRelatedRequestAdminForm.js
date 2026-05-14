(function () {
  const RELATED_REQUEST_LOOKUP = "cr69a_systemintake";
  const TARGET_ENTITY_NAME = "new_systemintake";
  const TARGET_FORM_ID = "e894fe33-da2e-f111-8341-001dd8055bb1";

  function sanitizeGuid(id) {
    return (id || "").replace(/[{}]/g, "");
  }

  async function showAlert(text) {
    await Xrm.Navigation.openAlertDialog({ text });
  }

  async function openRelatedRequestAdminForm(primaryControl) {
    const formContext = primaryControl;
    console.log("openRelatedRequestAdminForm called");

    if (!formContext) {
      await showAlert("Unable to access the current Admin Review form.");
      return;
    }

    const requestLookup = formContext.getAttribute(RELATED_REQUEST_LOOKUP);
    const requestValue = requestLookup?.getValue();

    if (!requestValue || requestValue.length === 0) {
      await showAlert(
        "This Admin Review does not have a related Intake Request yet.",
      );
      return;
    }

    const relatedRequest = requestValue[0];
    const requestId = sanitizeGuid(relatedRequest.id);

    if (!requestId) {
      await showAlert("Unable to determine the related Intake Request ID.");
      return;
    }

    try {
      await Xrm.Navigation.openForm({
        entityName: TARGET_ENTITY_NAME,
        entityId: requestId,
        formId: TARGET_FORM_ID,
        openInNewWindow: true,
      });
    } catch (error) {
      console.error("Failed to open the related Intake Request Admin form:", {
        error,
        requestId,
        targetEntityName: TARGET_ENTITY_NAME,
        targetFormId: TARGET_FORM_ID,
      });

      await (Xrm?.Navigation?.openErrorDialog
        ? Xrm.Navigation.openErrorDialog({
            message:
              "Something went wrong opening the related Intake Request Admin form.",
            details:
              (error && (error.message || error.toString())) || undefined,
          })
        : showAlert(
            "Something went wrong opening the related Intake Request Admin form.",
          ));
    }
  }

  window.ITGov_OpenRelatedRequestAdminForm = openRelatedRequestAdminForm;
})();
