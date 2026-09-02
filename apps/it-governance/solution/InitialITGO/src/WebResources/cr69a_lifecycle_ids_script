function onLoad(executionContext) {
  console.log("onload fired!");
  const formContext = executionContext.getFormContext();
  lockAllFields(formContext);
}

function lockAllFields(formContext, subgridNames) {
  if (parent.lockAllFields) {
    parent.lockAllFields(formContext);
  } else {
    console.warn("lockAllFields function not found on parent window");
  }
}
