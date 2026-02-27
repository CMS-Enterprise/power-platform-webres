//TODO - Remove this file

function onLoad(executionContext) {
  setDefaultName(executionContext);
}

function setDefaultName(executionContext) {
  var formContext = executionContext.getFormContext();

  console.log("set default name?");

  console.log(formContext.getAttribute("cr69a_systemintakeadmin"));

  const systemIntakeAdmin = formContext
    .getAttribute("cr69a_systemintakeadmin")
    .getValue();

  let name = "";
  console.log(systemIntakeAdmin);
  if (systemIntakeAdmin.length) {
    name = systemIntakeAdmin[0].name;
  }
  formContext
    .getAttribute("cr69a_editrequest")
    .setValue("Edit Request - " + name);
}
