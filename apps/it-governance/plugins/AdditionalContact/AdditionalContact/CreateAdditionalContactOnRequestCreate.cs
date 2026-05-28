using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;

namespace Cms.ItGovernance.Plugins.Request
{
    public class CreateAdditionalContactOnRequestCreate : IPlugin 
    {
        private const string RequestEntity = "new_systemintake";
        private const string AdditionalContactEntity = "cr69a_additionalcontact";

        private const string RequesterField = "cr69a_requester";
        private const string AdditionalContact_RequestLookup = "cr69a_systemintake"; // lookup on additionalcontact back to request
        private const string AdditionalContact_PersonLookup = "cr69a_user"; // lookup to systemuser/contact on additionalcontact
        private const string AdditionalContact_Role = "cr69a_contactrole"; // option set
        private const int Role_NoneSpecified = 216640001;
        private const string AdditionalContact_Component = "cr69a_component"; // option set
        private const int Component_NoneSpecified = 216640001;
        private const string IsRequesterField = "cr69a_isrequester";
        private const string SkipRequesterContactCreationField = "cr3ee_skiprequestercontactcreation";

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);

            tracing.Trace($"Plugin start. Message={context.MessageName}, Stage={context.Stage}, Mode={context.Mode}, Entity={context.PrimaryEntityName}");

            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity target))
            {
                tracing.Trace("No Target entity in context. Exiting.");
                return;
            }

            tracing.Trace($"Target LogicalName={target.LogicalName}, Id={target.Id}");

            // Safety: ensure correct entity + message
            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
                return;

            if (!string.Equals(target.LogicalName, RequestEntity, StringComparison.OrdinalIgnoreCase))
                return;

            // PostOperation should have an ID
            var requestId = context.PrimaryEntityId != Guid.Empty ? context.PrimaryEntityId : target.Id;
            if (requestId == Guid.Empty)
            {
                tracing.Trace("Request ID is empty in PostOperation. Exiting.");
                return;
            }

            if (ShouldSkipRequesterContactCreation(target, service, tracing, requestId))
            {
                tracing.Trace("Skip requester contact creation flag is true. Skipping additional contact creation.");
                return;
            }

            // Resolve requester
            EntityReference requester = null;

            if (target.Attributes.Contains(RequesterField) && target[RequesterField] is EntityReference er)
            {
                requester = er;
                tracing.Trace($"Requester from field: {requester.LogicalName} {requester.Id}");
            }
            else
            {
                // fallback to createdby if present in post image or via retrieve
                tracing.Trace($"Requester field not present on Target. Attempting fallback to createdby via Retrieve.");

                var request = service.Retrieve(RequestEntity, requestId, new ColumnSet("createdby"));
                if (request.Contains("createdby") && request["createdby"] is EntityReference createdBy)
                {
                    requester = createdBy;
                    tracing.Trace($"Requester fallback to createdby: {requester.LogicalName} {requester.Id}");
                }
            }

            if (requester == null)
            {
                tracing.Trace("No requester resolved. Skipping additional contact creation.");
                return;
            }

            // Create Additional Contact
            var additional = new Entity(AdditionalContactEntity);

            additional[AdditionalContact_RequestLookup] = new EntityReference(RequestEntity, requestId);
            additional[AdditionalContact_PersonLookup] = requester; // ensure this field type matches (systemuser vs contact)
            additional[AdditionalContact_Role] = new OptionSetValue(Role_NoneSpecified);
            additional[AdditionalContact_Component] = new OptionSetValue(Component_NoneSpecified);
            additional[IsRequesterField] = true;

            var additionalId = service.Create(additional);

            tracing.Trace($"Created Additional Contact: {additionalId}");
        }

        private static bool ShouldSkipRequesterContactCreation(Entity target, IOrganizationService service, ITracingService tracing, Guid requestId)
        {
            if (target.Attributes.Contains(SkipRequesterContactCreationField))
            {
                var skipFromTarget = target.GetAttributeValue<bool>(SkipRequesterContactCreationField);
                tracing.Trace($"Skip requester contact creation flag from Target: {skipFromTarget}");
                return skipFromTarget;
            }

            tracing.Trace("Skip requester contact creation flag not present on Target. Attempting Retrieve.");

            var request = service.Retrieve(RequestEntity, requestId, new ColumnSet(SkipRequesterContactCreationField));
            var skipFromRequest = request.GetAttributeValue<bool>(SkipRequesterContactCreationField);

            tracing.Trace($"Skip requester contact creation flag from Retrieve: {skipFromRequest}");

            return skipFromRequest;
        }
    }
}
