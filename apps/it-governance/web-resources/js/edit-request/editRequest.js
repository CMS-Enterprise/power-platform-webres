function hideFieldForUnauthorizedUsers(executionContext) {
    var formContext = executionContext.getFormContext();
    var roles = Xrm.Utility.getGlobalContext().userSettings.roles;

    var roleName = "IT Governance - Admin";
    
    var hasRole = roles.get(function(role) {
        return role.name === roleName;
    }).length > 0;

    var control = formContext.getControl("cr69a_adminnotes");
    if (control) {
        control.setVisible(hasRole);
    }
}