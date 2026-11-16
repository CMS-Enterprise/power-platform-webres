using System;
using System.Collections.Generic;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using SystemIntake.Plugins;

internal static class ActivityLogCreateTests
{
    private static readonly IPlugin Validator = new ActivityLog_Create_ValidateActivityType();
    private static readonly IPlugin Handler = new ActivityLog_Create_ApplyActivityType();
    private const int MakeChangesToRequest = 216640008;

    private static readonly string[] ActivityLogTextFields =
    {
        "new_requesttitle", "new_requestbusinessneed"
    };

    private static readonly string[] RequestTextFields =
    {
        "new_name", "cr3ee_business_need_multi"
    };

    private static void Main()
    {
        AssignsAdminLeadOnly();
        RejectsMissingField("new_systemintake", "Set Admin Lead requires a Request.");
        RejectsMissingField("new_adminlead", "Set Admin Lead requires an Admin Lead.");
        RejectsMissingField("cr3ee_reason", "Set Admin Lead requires a reason.");
        RejectsBlankReason();
        IgnoresUnrelatedActivityTypes();
        SkipsMigratedActivityLogs();
        PreservesFormalEditRequestBehavior();
        RejectsInvalidRequestChanges();
        CopiesAllRequestValues();
        ClearsAllRequestValues();
        CopiesMixedRequestValues();
        RejectsUnchangedRequestValues();
        RejectsNonTransactionalRequestChanges();
        ThrowsOnRequestUpdateFailure();
        RejectsInvalidReassignment();
        VerifiesReassignment(Guid.NewGuid());
        VerifiesReassignment(null);
        RejectsNoOpReassignment();
        ThrowsOnAssignmentFailure();
        Console.WriteLine("All Activity Log unit tests passed.");
    }

    private static void AssignsAdminLeadOnly()
    {
        var target = NewSetAdminLeadLog();
        var services = new PluginServices(target);
        RunCreate(services);

        Require(services.Updates.Count == 1, "Expected one Request update.");
        var update = services.Updates[0];
        Require(update.LogicalName == "new_systemintake", "Expected a Request update.");
        Require(update.Id == target.GetAttributeValue<EntityReference>("new_systemintake").Id,
            "Expected the related Request to be updated.");
        Require(update.Attributes.Count == 1 && update.GetAttributeValue<EntityReference>("new_adminlead")
            .Equals(target.GetAttributeValue<EntityReference>("new_adminlead")),
            "Expected only the Admin Lead lookup to be updated.");
    }

    private static void RejectsMissingField(string field, string expectedMessage)
    {
        var target = NewSetAdminLeadLog();
        target.Attributes.Remove(field);
        ExpectValidationError(target, expectedMessage);
    }

    private static void RejectsBlankReason()
    {
        var target = NewSetAdminLeadLog();
        target["cr3ee_reason"] = "  ";
        ExpectValidationError(target, "Set Admin Lead requires a reason.");
    }

    private static void ExpectValidationError(Entity target, string expectedMessage)
    {
        var services = new PluginServices(target);
        ExpectPluginError(Validator, services, 20, expectedMessage);
        ExpectPluginError(Handler, services, 40, expectedMessage);
        Require(services.Updates.Count == 0, "Invalid Activity Logs must leave the Request untouched.");
    }

    private static void ExpectPluginError(IPlugin plugin, PluginServices services, int stage, string expectedMessage)
    {
        services.Context.Stage = stage;
        try
        {
            plugin.Execute(services);
        }
        catch (InvalidPluginExecutionException ex) when (ex.Message == expectedMessage)
        {
            return;
        }

        throw new Exception("Expected a plugin error: " + expectedMessage);
    }

    private static void IgnoresUnrelatedActivityTypes()
    {
        var services = new PluginServices(NewActivityLog(999999999));
        RunCreate(services);
        Require(services.Updates.Count == 0 && services.SystemServiceRequests == 0,
            "Unrelated activity types must not update the Request or acquire a SYSTEM service.");
    }

    private static void RejectsInvalidRequestChanges()
    {
        var target = NewRequestChangesLog();
        var request = target["new_systemintake"];
        target.Attributes.Remove("new_systemintake");
        var services = new PluginServices(target);
        ExpectPluginError(Handler, services, 40, "A related Request is required to update Request details.");

        target["new_systemintake"] = request;
        target.Attributes.Remove("cr3ee_reason");
        ExpectPluginError(Handler, services, 40, "A reason is required to update Request details.");
        target["cr3ee_reason"] = " \t ";
        ExpectPluginError(Handler, services, 40, "A reason is required to update Request details.");
        Require(services.Updates.Count == 0 && services.SystemServiceRequests == 0,
            "Invalid input must be rejected before acquiring the SYSTEM service.");
    }

    private static void CopiesAllRequestValues()
    {
        var target = NewRequestChangesLog();
        var values = new[] { "Title", "Business need" };
        for (var index = 0; index < values.Length; index++)
            target[ActivityLogTextFields[index]] = values[index];

        target["ownerid"] = new EntityReference("systemuser", Guid.NewGuid());
        target["cr69a_readyforreview"] = false;
        target["new_requestproposedsolution"] = "Ignored solution";
        target["new_requestcmsbenefit"] = "Ignored benefit";
        target["new_requestpriorityalignment"] = "";
        target["new_requestsuccesscriteria"] = null;
        AssertRequestUpdate(target, new[] { "Old title", "Old need" }, values,
            "Request Title\nBefore: Old title\nAfter: Title\n\nBusiness or User Need\nBefore: Old need\nAfter: Business need");
    }

    private static void ClearsAllRequestValues()
    {
        var target = NewRequestChangesLog();
        target["new_requesttitle"] = "";
        target["new_requestbusinessneed"] = null;
        AssertRequestUpdate(target, new[] { "Old title", "Old need" }, new string[RequestTextFields.Length],
            "Request Title\nBefore: Old title\nAfter: [cleared]\n\nBusiness or User Need\nBefore: Old need\nAfter: [cleared]");
    }

    private static void CopiesMixedRequestValues()
    {
        var target = NewRequestChangesLog();
        target["new_requesttitle"] = "New title";
        target["new_requestbusinessneed"] = "First\r\nSecond";
        AssertRequestUpdate(target, new[] { null, "First\rSecond" }, new[] { "New title" },
            "Request Title\nBefore: [blank]\nAfter: New title");

        target["new_requestbusinessneed"] = "<first>\r\nSecond";
        AssertRequestUpdate(target, new[] { "New title", "Old\rvalue" }, new[] { "<first>\r\nSecond" },
            "Business or User Need\nBefore: Old\nvalue\nAfter: <first>\nSecond");
    }

    private static void RejectsUnchangedRequestValues()
    {
        var target = NewRequestChangesLog();
        target["new_requesttitle"] = "";
        var services = RequestChangeServices(target);
        ExpectPluginError(Handler, services, 40, "No Request values were changed.");
        Require(services.Updates.Count == 0, "A no-op must not write any records.");
    }

    private static PluginServices RequestChangeServices(Entity target)
    {
        var request = target.GetAttributeValue<EntityReference>("new_systemintake");
        var services = new PluginServices(target)
        {
            RequireSystemUpdate = true,
            CurrentRequest = new Entity("new_systemintake", request.Id)
        };
        services.Context.PrimaryEntityId = Guid.NewGuid();
        return services;
    }

    private static void AssertRequestUpdate(Entity target, string[] previous, string[] expected, string summary)
    {
        var auditValues = new Dictionary<string, object>();
        foreach (var attribute in target.Attributes)
            auditValues.Add(attribute.Key, attribute.Value);

        var services = RequestChangeServices(target);
        for (var index = 0; index < previous.Length; index++)
            services.CurrentRequest[RequestTextFields[index]] = previous[index];
        services.Context.UserId = Guid.NewGuid();
        services.Context.InitiatingUserId = services.Context.UserId;
        RunCreate(services);

        Require(services.SystemServiceRequests == 1 && services.Updates.Count == 2,
            "Expected both updates using SYSTEM when the initiating user cannot update the Request.");
        var update = services.Updates[0];
        Require(update.LogicalName == "new_systemintake"
            && update.Id == target.GetAttributeValue<EntityReference>("new_systemintake").Id,
            "Expected the related Request to be updated.");
        Require(update.Attributes.Count == expected.Length, "Expected only changed Request fields.");
        var indexOfChange = 0;
        foreach (var field in RequestTextFields)
        {
            if (update.Contains(field))
                Require(Equals(update[field], expected[indexOfChange++]), "Unexpected Request value for " + field);
        }
        Require(indexOfChange == expected.Length, "Expected updates to allowlisted fields only.");
        var audit = services.Updates[1];
        Require(audit.LogicalName == "new_activitylogs" && audit.Id == services.Context.PrimaryEntityId
            && audit.Attributes.Count == 1 && Equals(audit["new_changesummary"], summary),
            "Expected the generated before/after summary as the sole audit update.");

        Require(target.Attributes.Count == auditValues.Count, "Expected the audit fields to be preserved.");
        foreach (var attribute in auditValues)
            Require(target.Contains(attribute.Key) && Equals(target[attribute.Key], attribute.Value),
                "Unexpected change to Activity Log audit field " + attribute.Key);
    }

    private static void RejectsNonTransactionalRequestChanges()
    {
        var services = new PluginServices(NewRequestChangesLog());
        services.Context.IsInTransaction = false;
        ExpectPluginError(Handler, services, 40, "Make Changes to Request requires a synchronous PostOperation transaction.");
        Require(services.SystemServiceRequests == 0, "An unconfigured step must not attempt a privileged update.");
    }

    private static void ThrowsOnRequestUpdateFailure()
    {
        var target = NewRequestChangesLog();
        target["new_requesttitle"] = "Updated";
        var services = RequestChangeServices(target);
        services.UpdateFailure = new FaultException<OrganizationServiceFault>(
            new OrganizationServiceFault { ErrorCode = unchecked((int)0x80040217) });
        ExpectPluginError(Handler, services, 40, "The related Request no longer exists. Select an existing Request.");

        services.UpdateFailure = new FaultException<OrganizationServiceFault>(
            new OrganizationServiceFault { ErrorCode = unchecked((int)0x80040216) });
        // Dataverse rolls back the synchronous Create when the plugin throws.
        ExpectPluginError(Handler, services, 40,
            "The Request changes could not be applied. No changes were made.");
        Require(services.SystemServiceRequests == 2 && services.Updates.Count == 0,
            "Expected both privileged update failures to propagate without saving an update.");

        services.FailAuditUpdate = true;
        ExpectPluginError(Handler, services, 40, "The Request changes could not be applied. No changes were made.");
        Require(services.Updates.Count == 1 && services.Updates[0].LogicalName == "new_systemintake",
            "The audit write must fail after the Request update and propagate to Dataverse for rollback.");
    }

    private static void RejectsInvalidReassignment()
    {
        var services = NewReassignment();
        var target = (Entity)services.Context.InputParameters["Target"];
        var request = target["new_systemintake"];
        var requester = target["new_newrequester"];
        target.Attributes.Remove("new_systemintake");
        ExpectPluginError(Handler, services, 40, "A related Request is required to reassign the requester.");
        target["new_systemintake"] = request;
        target.Attributes.Remove("new_newrequester");
        ExpectPluginError(Handler, services, 40, "A new requester is required.");
        target["new_newrequester"] = requester;
        target["cr3ee_reason"] = " \t ";
        ExpectPluginError(Handler, services, 40, "A reason is required to reassign the requester.");
        target["cr3ee_reason"] = "Transfer the Request.";
        target["new_newrequester"] = new EntityReference("team", Guid.NewGuid());
        ExpectPluginError(Handler, services, 40, "The selected requester must be an active user.");
        Require(services.SystemServiceRequests == 0, "Malformed input must not acquire SYSTEM.");
        target["new_newrequester"] = requester;
        services.SelectedUser["isdisabled"] = true;
        ExpectPluginError(Handler, services, 40, "The selected requester must be an active user.");
        Require(services.Updates.Count == 0, "Invalid reassignment must not write any records.");
    }

    private static void VerifiesReassignment(Guid? previousRequesterId)
    {
        var services = NewReassignment();
        var previousRequester = previousRequesterId.HasValue
            ? new EntityReference("systemuser", previousRequesterId.Value)
            : null;
        services.CurrentRequest["cr69a_requester"] = previousRequester;
        RunCreate(services);

        Require(services.SystemServiceRequests == 1 && services.Updates.Count == 2,
            "A non-owner must be able to write both records through SYSTEM.");
        var audit = services.Updates[0];
        Require(audit.LogicalName == "new_activitylogs" && audit.Id == services.Context.PrimaryEntityId
            && audit.Attributes.Count == 1 && audit.Contains("new_previousrequester")
            && Equals(audit["new_previousrequester"], previousRequester),
            "Expected the prior requester from the Request to be the sole audit update.");
        var update = services.Updates[1];
        var selected = services.SelectedUser.ToEntityReference();
        Require(update.LogicalName == "new_systemintake" && update.Id == services.CurrentRequest.Id
            && update.Attributes.Count == 2 && Equals(update["cr69a_requester"], selected)
            && Equals(update["ownerid"], selected), "Expected one update setting only requester and owner.");
    }

    private static void RejectsNoOpReassignment()
    {
        var services = NewReassignment();
        var selected = services.SelectedUser.ToEntityReference();
        services.CurrentRequest["cr69a_requester"] = selected;
        services.CurrentRequest["ownerid"] = selected;
        ExpectPluginError(Handler, services, 40, "The selected user is already the requester and owner of this Request.");
        Require(services.Updates.Count == 0, "A no-op must not write any records.");

        services.CurrentRequest["ownerid"] = new EntityReference("team", Guid.NewGuid());
        RunCreate(services);
        Require(services.Updates.Count == 2, "A requester match alone must still repair ownership.");
    }

    private static void ThrowsOnAssignmentFailure()
    {
        var services = NewReassignment();
        services.UpdateFailure = new FaultException<OrganizationServiceFault>(new OrganizationServiceFault());
        // An exception must escape the synchronous pipeline so Dataverse rolls back the audit write and Create.
        ExpectPluginError(Handler, services, 40, "The Request could not be reassigned. No changes were made.");
        Require(services.Updates.Count == 1 && services.Updates[0].LogicalName == "new_activitylogs",
            "The injected failure must occur at the Request write after the audit write.");
    }

    private static PluginServices NewReassignment()
    {
        var request = new Entity("new_systemintake", Guid.NewGuid());
        request["ownerid"] = new EntityReference("team", Guid.NewGuid());
        var user = new Entity("systemuser", Guid.NewGuid());
        user["isdisabled"] = false;
        var target = NewActivityLog(216640009);
        target["new_systemintake"] = request.ToEntityReference();
        target["new_newrequester"] = user.ToEntityReference();
        target["cr3ee_reason"] = "Transfer the Request.";
        var services = new PluginServices(target)
        {
            RequireSystemUpdate = true,
            SelectedUser = user,
            CurrentRequest = request
        };
        services.Context.PrimaryEntityId = Guid.NewGuid();
        services.Context.UserId = Guid.NewGuid();
        services.Context.InitiatingUserId = services.Context.UserId;
        return services;
    }

    private static Entity NewRequestChangesLog()
    {
        var target = NewActivityLog(MakeChangesToRequest);
        target["new_systemintake"] = new EntityReference("new_systemintake", Guid.NewGuid());
        target["cr3ee_reason"] = "Record the admin's changes.";
        return target;
    }

    private static void SkipsMigratedActivityLogs()
    {
        var target = NewActivityLog(216640007);
        target["cr3ee_batchid"] = "migration";
        var services = new PluginServices(target);
        RunCreate(services);
        Require(services.Updates.Count == 0, "Migrated logs must leave the Request untouched.");
    }

    private static void PreservesFormalEditRequestBehavior()
    {
        var target = NewActivityLog(216640005);
        target["new_systemintake"] = new EntityReference("new_systemintake", Guid.NewGuid());
        target["new_adminreview"] = new EntityReference("cr69a_systemintakeadmin", Guid.NewGuid());
        target["new_process_target_step"] = new OptionSetValue(971270001);
        var services = new PluginServices(target);
        services.Context.Depth = 2;
        RunCreate(services);

        Require(services.Updates.Count == 2, "Expected Edit Request to update both Review and Request.");
        Require(services.Updates[0].GetAttributeValue<OptionSetValue>("new_admingovernancetasklist")?.Value == 971270001,
            "Expected Edit Request to update the Review step.");
        var request = services.Updates[1];
        Require(request.GetAttributeValue<OptionSetValue>("new_admingovernanceprocessstep")?.Value == 971270001
            && Equals(request["cr69a_readyforreview"], false) && !request.Contains("new_adminlead"),
            "Expected Edit Request to update the Request step and clear Ready for Review.");
    }

    private static Entity NewSetAdminLeadLog()
    {
        var target = NewActivityLog(216640007);
        target["new_systemintake"] = new EntityReference("new_systemintake", Guid.NewGuid());
        target["new_adminlead"] = new EntityReference("systemuser", Guid.NewGuid());
        target["cr3ee_reason"] = "Assign the lead for this Request.";
        return target;
    }

    private static Entity NewActivityLog(int activityType)
    {
        var target = new Entity("new_activitylogs");
        target["cr3ee_activitytype"] = new OptionSetValue(activityType);
        return target;
    }

    private static void RunCreate(PluginServices services)
    {
        services.Context.Stage = 20;
        Validator.Execute(services);
        services.Context.Stage = 40;
        Handler.Execute(services);
    }

    private static void Require(bool condition, string message)
    {
        if (!condition)
            throw new Exception(message);
    }

    private sealed class PluginServices : IServiceProvider, IOrganizationServiceFactory, IOrganizationService
    {
        public RemoteExecutionContext Context { get; } = new RemoteExecutionContext
        {
            PrimaryEntityName = "new_activitylogs",
            MessageName = "Create",
            Depth = 1,
            IsInTransaction = true
        };

        public List<Entity> Updates { get; } = new List<Entity>();
        public bool RequireSystemUpdate { get; set; }
        public Exception UpdateFailure { get; set; }
        public bool FailAuditUpdate { get; set; }
        public Entity SelectedUser { get; set; }
        public Entity CurrentRequest { get; set; }
        public int SystemServiceRequests { get; private set; }
        private Guid? serviceUserId;

        public PluginServices(Entity target)
        {
            Context.InputParameters["Target"] = target;
        }

        public object GetService(Type serviceType)
        {
            if (serviceType == typeof(IPluginExecutionContext))
                return Context;
            if (serviceType == typeof(IOrganizationServiceFactory))
                return this;
            return null;
        }

        public IOrganizationService CreateOrganizationService(Guid? userId)
        {
            serviceUserId = userId;
            if (!userId.HasValue)
                SystemServiceRequests++;
            return this;
        }

        public void Update(Entity entity)
        {
            if (RequireSystemUpdate && serviceUserId.HasValue)
                throw new UnauthorizedAccessException();
            if (UpdateFailure != null && entity.LogicalName == (FailAuditUpdate ? "new_activitylogs" : "new_systemintake"))
                throw UpdateFailure;
            Updates.Add(entity);
        }

        public Guid Create(Entity entity) => throw new NotSupportedException();
        public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet)
        {
            if (serviceUserId.HasValue)
                throw new UnauthorizedAccessException();
            if (entityName == "systemuser" && SelectedUser?.Id == id)
                return SelectedUser;
            if (entityName == "new_systemintake" && CurrentRequest?.Id == id)
                return CurrentRequest;
            throw new NotSupportedException();
        }
        public void Delete(string entityName, Guid id) => throw new NotSupportedException();
        public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
        public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
        public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
        public EntityCollection RetrieveMultiple(QueryBase query) => throw new NotSupportedException();
    }
}
