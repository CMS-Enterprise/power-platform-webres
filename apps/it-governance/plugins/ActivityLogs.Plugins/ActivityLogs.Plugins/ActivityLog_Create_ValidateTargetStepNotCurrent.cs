using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_ValidateTargetStepNotCurrent : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";

        // Activity Log fields
        private const string TargetStepField = "new_process_target_step"; // Choice (global)
        private const string ReviewLookupField = "new_adminreview";       // Lookup -> cr69a_systemintakeadmin

        // Review fields
        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReviewStepField = "new_admingovernancetasklist"; // Choice (same global)

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context == null) return;

            if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase)) return;
            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase)) return;

            // PreOperation only
            if (context.Stage != 20) return;

            object targetObj;
            if (!context.InputParameters.TryGetValue("Target", out targetObj)) return;

            var target = targetObj as Entity;
            if (target == null) return;

            var step = target.GetAttributeValue<OptionSetValue>(TargetStepField);
            if (step == null) return; // if no step provided, nothing to validate

            var reviewRef = target.GetAttributeValue<EntityReference>(ReviewLookupField);
            if (reviewRef == null) return; // if no review link, nothing to validate

            var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = serviceFactory.CreateOrganizationService(context.UserId);

            var review = service.Retrieve(ReviewEntity, reviewRef.Id, new ColumnSet(ReviewStepField));
            var current = review.GetAttributeValue<OptionSetValue>(ReviewStepField);

            if (current != null && current.Value == step.Value)
            {
                throw new InvalidPluginExecutionException(
                    "That step is already the current step. Please choose a different target step."
                );
            }
        }
    }
}
