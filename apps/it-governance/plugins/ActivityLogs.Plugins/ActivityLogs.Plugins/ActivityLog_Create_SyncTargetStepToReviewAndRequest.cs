using System;
using Microsoft.Xrm.Sdk;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_SyncTargetStepToReviewAndRequest : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";

        // Activity Log fields
        private const string TargetStepField = "new_process_target_step"; // Choice (global)
        private const string ReviewLookupField = "new_adminreview";       // Lookup -> cr69a_systemintakeadmin
        private const string RequestLookupField = "new_systemintake";     // Lookup -> new_systemintake (Request)

        // Review fields
        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReviewStepField = "new_admingovernancetasklist"; // Choice (same global)

        // Request fields
        private const string RequestEntity = "new_systemintake";
        private const string RequestStepField = "new_admingovernanceprocessstep"; // Choice (same global)

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context == null) return;

            if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase)) return;
            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase)) return;

            // PostOperation only
            if (context.Stage != 40) return;

            object targetObj;
            if (!context.InputParameters.TryGetValue("Target", out targetObj)) return;

            var target = targetObj as Entity;
            if (target == null) return;

            var step = target.GetAttributeValue<OptionSetValue>(TargetStepField);
            if (step == null) return;

            var reviewRef = target.GetAttributeValue<EntityReference>(ReviewLookupField);
            var requestRef = target.GetAttributeValue<EntityReference>(RequestLookupField);

            var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = serviceFactory.CreateOrganizationService(context.UserId);

            // Update Review step (if present)
            if (reviewRef != null)
            {
                var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
                reviewUpdate[ReviewStepField] = new OptionSetValue(step.Value);
                service.Update(reviewUpdate);
            }

            // Update Request step (if present)
            if (requestRef != null)
            {
                var requestUpdate = new Entity(RequestEntity, requestRef.Id);
                requestUpdate[RequestStepField] = new OptionSetValue(step.Value);
                service.Update(requestUpdate);
            }
        }
    }
}