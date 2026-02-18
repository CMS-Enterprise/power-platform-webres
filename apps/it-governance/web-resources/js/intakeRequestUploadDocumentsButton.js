async function openIntakeFileUpload(primaryControl) {
  const formContext = primaryControl;
  console.log("openIntakeFileUpload");

  if (!formContext) {
    console.error("No form context provided.");
    return;
  }

  const recordId = formContext.data.entity.getId();
  const entityName = formContext.data.entity.getEntityName();
  console.log("2");

  if (!recordId) {
    Xrm.Navigation.openAlertDialog({
      text: "Unable to determine record ID.",
    });
    return;
  }

  const pageInput = {
    pageType: "custom",
    name: "new_intakefileupload_e1db9",
    recordId,
    entityName,
  };

  const navigationOptions = {
    target: 2,
    width: { value: 900, unit: "px" },
    height: { value: 650, unit: "px" },
  };

  try {
    console.log("3");
    // Open modal and wait for close
    await Xrm.Navigation.navigateTo(pageInput, navigationOptions);
    console.log("4");
    // Force refresh from server
    await formContext.data.refresh(true);
  } catch (error) {
    console.error("Error opening file upload page:", error);
    Xrm.Navigation.openAlertDialog({
      text: "Something went wrong opening the File Upload page.",
    });
  }
}
