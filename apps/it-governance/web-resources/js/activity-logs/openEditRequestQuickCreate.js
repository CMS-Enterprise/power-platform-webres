async function openEditRequestQuickCreate(primaryControl) {
  const formContext = primaryControl;

  try {
    // --- Review (parent record) ---
    const reviewId = formContext.data.entity.getId().replace(/[{}]/g, "");
    const reviewName =
      formContext.data.entity.getPrimaryAttributeValue() || "Review";

    // --- System Intake lookup from parent form ---
    const systemIntakeAttr = formContext.getAttribute("cr69a_systemintake");
    const systemIntakeValue = systemIntakeAttr?.getValue();

    let parameters = {
      // Prefill Review lookup
      cr69a_systemintakeadmin: reviewId,
      cr69a_systemintakeadminname: reviewName,
      cr69a_systemintakeadmintype: "cr69a_systemintakeadmin",
    };

    // Prefill Request lookup if present
    if (systemIntakeValue && systemIntakeValue.length > 0) {
      const intake = systemIntakeValue[0];

      parameters.cr69a_systemintake = intake.id.replace(/[{}]/g, "");
      parameters.cr69a_systemintakename = intake.name;
      parameters.cr69a_systemintaketype = "new_systemintake";
    }

    const formOptions = {
      entityName: "cr69a_editrequest",
      useQuickCreateForm: true,
    };

    const result = await Xrm.Navigation.openForm(formOptions, parameters);

    if (result?.savedEntityReference) {
      await formContext.data.refresh(true);
    }
  } catch (e) {
    console.error("Failed to open/close modal or refresh form:", e);

    await Xrm.Navigation.openAlertDialog({
      text: "Something went wrong opening the Edit Requests Quick Create form.",
    });

    throw e;
  }
}
