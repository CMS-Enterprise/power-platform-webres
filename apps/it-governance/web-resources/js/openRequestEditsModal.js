async function openRequestEditsModal(primaryControl) {
  const formContext = primaryControl; // keep this name consistent

  const recordId = formContext.data.entity.getId();
  const entityName = formContext.data.entity.getEntityName();

  const pageInput = {
    pageType: "custom",
    name: "new_cprequestedits_ecb9f",
    recordId,
    entityName,
  };

  const navigationOptions = {
    target: 2,
    width: { value: 900, unit: "px" },
    height: { value: 650, unit: "px" },
  };

  try {
    const result = await Xrm.Navigation.navigateTo(
      pageInput,
      navigationOptions,
    );
    console.log("Modal closed. Result:", result);

    // Force refresh from server
    await formContext.data.refresh(true);

    return result;
  } catch (e) {
    console.error("Failed to open/close modal or refresh form:", e);
    await Xrm.Navigation.openAlertDialog({
      text: "Something went wrong opening the Edit Requests page.",
    });
    throw e;
  }
}
