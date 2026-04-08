async function openIntakeFileUpload(primaryControl) {
  const formContext = primaryControl;

  if (!formContext) {
    console.error("No form context provided.");
    return;
  }

  const recordId = formContext.data.entity.getId(); // returns "{GUID}"
  const entityName = formContext.data.entity.getEntityName();

  if (!recordId) {
    await Xrm.Navigation.openAlertDialog({
      text: "Unable to determine record ID.",
    });
    return;
  }
  if (!entityName) {
    await Xrm.Navigation.openAlertDialog({
      text: "Unable to determine entityName.",
    });
    return;
  }

  const pageInput = {
    pageType: "custom",
    name: "new_intakefileupload_e1db9", // logical name of the custom page
    recordId, // GUID required by the platform
    entityName, // logical table name
  };

  const navigationOptions = {
    target: 2, // open as dialog
    position: 1, // centered dialog (optional)
    width: { value: 900, unit: "px" },
    height: { value: 650, unit: "px" },
    title: "Upload Files", // optional but nice for UX
  };

  try {
    console.log("before navigate to");
    await Xrm.Navigation.navigateTo(pageInput, navigationOptions); // resolves when dialog closes
    console.log("dialog closed");
    await formContext.data.refresh(true); // now refresh the host form
    console.log("after refresh");
  } catch (error) {
    console.error("Error opening file upload page:", error);
    await Xrm.Navigation.openAlertDialog({
      text: "Something went wrong opening the File Upload page.",
    });
  }
}
