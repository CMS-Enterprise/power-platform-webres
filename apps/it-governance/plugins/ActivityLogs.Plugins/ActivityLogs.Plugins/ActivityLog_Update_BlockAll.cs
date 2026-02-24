using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;
using System.Linq;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Update_BlockAll : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context == null) return;

            // Only care about Activity Log updates
            if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase)) return;
            if (!string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase)) return;

            // PreOperation only
            if (context.Stage != 20) return;

            // Create org service
            var serviceFactory =
                (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));

            var service = serviceFactory.CreateOrganizationService(context.UserId);

            // Allow System Administrators to bypass
            if (UserIsSystemAdmin(service, context.UserId))
            {
                return;
            }

            // Block everyone else
            throw new InvalidPluginExecutionException(
                "Activity Logs are immutable and cannot be updated. Create a new Activity Log entry instead."
            );
        }

        private bool UserIsSystemAdmin(IOrganizationService service, Guid userId)
        {
            var query = new QueryExpression("role")
            {
                ColumnSet = new ColumnSet("name"),
                Criteria =
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            "name",
                            ConditionOperator.Equal,
                            "System Administrator"
                        )
                    }
                }
            };

            query.LinkEntities.Add(new LinkEntity
            {
                LinkFromEntityName = "role",
                LinkFromAttributeName = "roleid",
                LinkToEntityName = "systemuserroles",
                LinkToAttributeName = "roleid",
                LinkCriteria =
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            "systemuserid",
                            ConditionOperator.Equal,
                            userId
                        )
                    }
                }
            });

            var roles = service.RetrieveMultiple(query);
            return roles.Entities.Any();
        }
    }
}
