using System;
using Microsoft.Xrm.Sdk;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Update_BlockAll : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context == null) return;

            if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase)) return;
            if (!string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase)) return;

            // PreOperation only
            if (context.Stage != 20) return;

            // If you want to allow SYSTEM/INTEGRATION updates, you can add exceptions here later.
            throw new InvalidPluginExecutionException(
                "Activity Logs are immutable and cannot be updated. Create a new Activity Log entry instead."
            );
        }
    }
}