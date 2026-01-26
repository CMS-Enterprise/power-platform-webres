let
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intake_internal_grb_review_discussion_posts.csv"
        ),
        [
            Delimiter = ",",
            Columns = 11,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    // Replace literal "NULL" strings with actual null values
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    // Apply column types AFTER cleanup
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"content", type text},
            {"voting_role", type text},
            {"grb_role", type text},
            {"system_intake_id", type text},
            {"reply_to_id", type text},
            {"created_by", type text},
            {"created_at", type datetime},
            {"modified_by", type text},
            {"modified_at", type text},
            {"discussion_board_type", type text}
        }
    )
in
    #"Changed column type"
