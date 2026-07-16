using System;
using Microsoft.Xrm.Sdk;

namespace SystemIntake.Plugins
{
    public class LifecycleId_SetDisplayName : IPlugin
    {
        private const int PreOperationStage = 20;

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
                return;

            if (!string.Equals(context.PrimaryEntityName, LifecycleIdDisplayName.EntityName, StringComparison.OrdinalIgnoreCase))
                return;

            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase))
                return;

            if (context.Stage != PreOperationStage)
            {
                tracing?.Trace("LifecycleId_SetDisplayName must be registered in PreOperation.");
                return;
            }

            if (!context.InputParameters.Contains("Target") ||
                !(context.InputParameters["Target"] is Entity target))
            {
                tracing?.Trace("LifecycleId_SetDisplayName: No target entity found.");
                return;
            }

            if (!string.Equals(target.LogicalName, LifecycleIdDisplayName.EntityName, StringComparison.OrdinalIgnoreCase))
                return;

            Entity existing = null;
            if (string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase))
            {
                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);
                existing = service.Retrieve(
                    LifecycleIdDisplayName.EntityName,
                    target.Id,
                    LifecycleIdDisplayName.ColumnSet());
            }

            var values = LifecycleIdDisplayName.BuildValueSnapshot(target, existing);
            var displayName = LifecycleIdDisplayName.Build(values);
            if (string.IsNullOrWhiteSpace(displayName))
            {
                tracing?.Trace("LifecycleId_SetDisplayName: No raw LCID available. Display name was not changed.");
                return;
            }

            target[LifecycleIdDisplayName.NameField] = displayName;
            tracing?.Trace("LifecycleId_SetDisplayName: Set display name to {0}.", displayName);
        }
    }
}
