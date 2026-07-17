(function (global) {
  const ACTIVITY_TYPE_FIELD = "new_activitytype";
  const ACTIVITY_TYPES = {
    Edit: 100000008,
  };

  const EDIT_FIELDS = [
    "new_lcidcostbaselineold",
    "new_lcidcostbaseline",
    "new_lcidscopeold",
    "new_lcidscope",
    "new_lcidexpirationdateold",
    "new_lcidexpirationdate",
    "new_lcidretiredateold",
    "new_lcidretiredate",
  ];

  function onLoad(executionContext) {
    const formContext = executionContext.getFormContext();
    const activityTypeAttribute = formContext.getAttribute(ACTIVITY_TYPE_FIELD);

    applyActivityTypeRules(formContext);
    activityTypeAttribute?.addOnChange(() => applyActivityTypeRules(formContext));
  }

  function applyActivityTypeRules(formContext) {
    const activityType = formContext
      .getAttribute(ACTIVITY_TYPE_FIELD)
      ?.getValue();
    const showEditFields = activityType === ACTIVITY_TYPES.Edit;

    EDIT_FIELDS.forEach((fieldName) =>
      setFieldVisible(formContext, fieldName, showEditFields),
    );
  }

  function setFieldVisible(formContext, fieldName, visible) {
    const attribute = formContext.getAttribute(fieldName);

    if (attribute?.controls?.getLength()) {
      attribute.controls.forEach((control) => control.setVisible(visible));
      return;
    }

    formContext.getControl(fieldName)?.setVisible(visible);
  }

  global.ITGov = global.ITGov || {};
  global.ITGov.LcidActivityLogMainForm = {
    onLoad,
    applyActivityTypeRules,
  };
})(window);
