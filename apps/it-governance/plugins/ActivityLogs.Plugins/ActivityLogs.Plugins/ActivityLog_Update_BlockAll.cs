using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;
using System.Linq;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Update_BlockAll : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";
        private const int PreOperationStage = 20;

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("ActivityLog_Update_BlockAll: context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "ActivityLog_Update_BlockAll: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}, OperationId={8}",
                context.MessageName,
                context.PrimaryEntityName,
                context.Stage,
                context.Mode,
                context.Depth,
                context.UserId,
                context.InitiatingUserId,
                context.CorrelationId,
                context.OperationId
            );

            try
            {
                // Only care about Activity Log updates
                if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase))
                {
                    tracing?.Trace("ActivityLog_Update_BlockAll: Not target entity ({0}). Exiting.", ActivityLogEntity);
                    return;
                }

                if (!string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase))
                {
                    tracing?.Trace("ActivityLog_Update_BlockAll: Not Update message. Exiting.");
                    return;
                }

                // PreOperation only
                if (context.Stage != PreOperationStage)
                {
                    tracing?.Trace("ActivityLog_Update_BlockAll: Not PreOperation (Stage {0}). Exiting.", PreOperationStage);
                    return;
                }

                // Create org service
                var serviceFactory =
                    (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));

                var service = serviceFactory.CreateOrganizationService(context.UserId);

                tracing?.Trace("ActivityLog_Update_BlockAll: Checking System Administrator role for UserId={0}", context.UserId);

                // Allow System Administrators to bypass
                if (UserIsSystemAdmin(service, context.UserId, tracing))
                {
                    tracing?.Trace("ActivityLog_Update_BlockAll: User is System Administrator. Bypassing block.");
                    return;
                }

                tracing?.Trace("ActivityLog_Update_BlockAll: Blocking update. Throwing InvalidPluginExecutionException.");
                // Block everyone else
                throw new InvalidPluginExecutionException(
                    "Activity Logs are immutable and cannot be updated. Create a new Activity Log entry instead."
                );
            }
            catch (InvalidPluginExecutionException)
            {
                // We intentionally throw this for non-admins. Still helpful to trace that it occurred.
                tracing?.Trace("ActivityLog_Update_BlockAll: InvalidPluginExecutionException thrown (expected for non-admin update attempts).");
                throw;
            }
            catch (Exception ex)
            {
                tracing?.Trace("ActivityLog_Update_BlockAll: Unexpected exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("ActivityLog_Update_BlockAll: End.");
            }
        }

        private bool UserIsSystemAdmin(IOrganizationService service, Guid userId, ITracingService tracing)
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

            tracing?.Trace("ActivityLog_Update_BlockAll: Retrieving roles for user via QueryExpression.");
            var roles = service.RetrieveMultiple(query);

            var isAdmin = roles.Entities.Any();
            tracing?.Trace("ActivityLog_Update_BlockAll: Role query returned {0} records. isAdmin={1}", roles.Entities.Count, isAdmin);

            return isAdmin;
        }
    }
}