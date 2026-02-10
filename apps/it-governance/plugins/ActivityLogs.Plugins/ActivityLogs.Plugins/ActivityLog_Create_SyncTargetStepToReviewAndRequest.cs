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
        private const string ReviewReadyForReviewField = "cr69a_readyforreview"; // Two Options (Yes/No)

        // Request fields
        private const string RequestEntity = "new_systemintake";
        private const string RequestStepField = "new_admingovernanceprocessstep"; // Choice (same global)
        private const string RequestReadyForReviewField = "cr69a_readyforreview"; // Two Options (Yes/No)

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

            var reviewRef = target.GetAttributeValue<EntityReference>(ReviewLookupField);
            var requestRef = target.GetAttributeValue<EntityReference>(RequestLookupField);

            // Step is optional now (we still want to clear Ready for Review even if step isn't set)
            var step = target.GetAttributeValue<OptionSetValue>(TargetStepField);

            var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = serviceFactory.CreateOrganizationService(context.UserId);

            // Update Review (if present)
            if (reviewRef != null)
            {
                var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);

                // Sync step only if provided on the log
                if (step != null)
                {
                    reviewUpdate[ReviewStepField] = new OptionSetValue(step.Value);
                }

                // Always set Ready for Review = false when an Activity Log is created
                reviewUpdate[ReviewReadyForReviewField] = false;

                service.Update(reviewUpdate);
            }

            // Update Request (if present)
            if (requestRef != null)
            {
                var requestUpdate = new Entity(RequestEntity, requestRef.Id);

                // Sync step only if provided on the log
                if (step != null)
                {
                    requestUpdate[RequestStepField] = new OptionSetValue(step.Value);
                }

                // Always set Ready for Review = false when an Activity Log is created
                requestUpdate[RequestReadyForReviewField] = false;

                service.Update(requestUpdate);
            }
        }
    }
}
