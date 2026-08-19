using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Request.Plugins
{
    public class Request_Update_SyncReadyForReviewToReview : IPlugin
    {
        private const string RequestEntity = "new_systemintake";
        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReadyForReviewField = "cr69a_readyforreview";
        private const string ReviewLookupField = "cr69a_systemintakereview";
        private const string PostImageAlias = "PostImage";
        private const int PostOperationStage = 40;

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("Request_Update_SyncReadyForReviewToReview: Context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "Request_Update_SyncReadyForReviewToReview: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}",
                context.MessageName,
                context.PrimaryEntityName,
                context.Stage,
                context.Mode,
                context.Depth,
                context.UserId,
                context.InitiatingUserId,
                context.CorrelationId
            );

            try
            {
                if (!IsExpectedContext(context, tracing))
                    return;

                var target = context.InputParameters["Target"] as Entity;
                if (target == null || !target.Attributes.Contains(ReadyForReviewField))
                {
                    tracing?.Trace("Request_Update_SyncReadyForReviewToReview: Target does not contain {0}. Exiting.", ReadyForReviewField);
                    return;
                }

                Entity postImage;
                if (!context.PostEntityImages.TryGetValue(PostImageAlias, out postImage) || postImage == null)
                {
                    throw new InvalidPluginExecutionException(
                        "Request Ready for Review synchronization is missing its required PostImage registration."
                    );
                }

                var reviewRef = postImage.GetAttributeValue<EntityReference>(ReviewLookupField);
                if (reviewRef == null)
                {
                    tracing?.Trace("Request_Update_SyncReadyForReviewToReview: Request has no related Review. Exiting.");
                    return;
                }

                if (!string.Equals(reviewRef.LogicalName, ReviewEntity, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidPluginExecutionException(
                        string.Format(
                            "Request Ready for Review synchronization received an unexpected Review entity type: {0}.",
                            reviewRef.LogicalName ?? "(null)"
                        )
                    );
                }

                var requestedValue = target.GetAttributeValue<bool>(ReadyForReviewField);
                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);
                var review = service.Retrieve(ReviewEntity, reviewRef.Id, new ColumnSet(ReadyForReviewField));
                var currentValue = review.GetAttributeValue<bool>(ReadyForReviewField);

                if (currentValue == requestedValue)
                {
                    tracing?.Trace(
                        "Request_Update_SyncReadyForReviewToReview: Review {0} already has {1}={2}. Skipping update.",
                        reviewRef.Id,
                        ReadyForReviewField,
                        requestedValue
                    );
                    return;
                }

                var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
                reviewUpdate[ReadyForReviewField] = requestedValue;
                service.Update(reviewUpdate);

                tracing?.Trace(
                    "Request_Update_SyncReadyForReviewToReview: Updated Review {0}. {1}={2}.",
                    reviewRef.Id,
                    ReadyForReviewField,
                    requestedValue
                );
            }
            catch (Exception ex)
            {
                tracing?.Trace("Request_Update_SyncReadyForReviewToReview: Exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("Request_Update_SyncReadyForReviewToReview: End.");
            }
        }

        private static bool IsExpectedContext(IPluginExecutionContext context, ITracingService tracing)
        {
            if (!string.Equals(context.PrimaryEntityName, RequestEntity, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase) ||
                context.Stage != PostOperationStage)
            {
                tracing?.Trace("Request_Update_SyncReadyForReviewToReview: Unexpected execution context. Exiting.");
                return false;
            }

            return context.InputParameters.Contains("Target");
        }
    }
}

