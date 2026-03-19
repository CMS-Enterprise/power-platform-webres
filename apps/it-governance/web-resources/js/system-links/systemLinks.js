function toggleOtherSystemDescription(executionContext) {
  var formContext = executionContext.getFormContext();

  var relationshipAttr = formContext.getAttribute(
    "cr69a_systemrelationshiptypemulti",
  );
  var otherDescControl = formContext.getControl("cr69a_othersystemdescription");
  var otherDescAttr = formContext.getAttribute("cr69a_othersystemdescription");

  if (!relationshipAttr || !otherDescControl) return;

  var values = relationshipAttr.getValue(); // array or null
  var OTHER_VALUE = 971270004;

  var hasOther = values && values.includes(OTHER_VALUE);

  if (hasOther) {
    otherDescControl.setVisible(true);
    otherDescAttr.setRequiredLevel("required");
  } else {
    otherDescControl.setVisible(false);
    otherDescAttr.setRequiredLevel("none");
    otherDescAttr.setValue(null); // optional cleanup
  }
}
