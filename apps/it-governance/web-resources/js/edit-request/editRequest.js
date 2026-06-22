function hideFieldForUnauthorizedUsers(executionContext) {
    var formContext = executionContext.getFormContext();
    var userId = Xrm.Utility.getGlobalContext().getUserId();
    
    // Check if user has a specific role
    var userRoles = Xrm.Utility.getGlobalContext().getUserRoles();
    var allowedRoleId = "4622b038-2217-f111-8407-001dd809993d";
    
    var hasRole = userRoles.some(function(roleId) {
        return roleId === allowedRoleId;
    });

    // Hide the field if they don't have the role
    formContext.getControl("cr69a_adminnotes").setVisible(hasRole);
}