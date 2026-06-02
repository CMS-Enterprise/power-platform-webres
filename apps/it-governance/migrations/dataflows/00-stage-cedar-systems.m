section Section1;
shared DataverseEnvironmentUrl = let
  DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text]
in
  DataverseEnvironmentUrl;
shared SharePointSiteUrl = let
  SharePointSiteUrl = "https://cmsgovonline-my.sharepoint.com/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text]
in
  SharePointSiteUrl;
shared FileName = let
  FileName = "cedar_systems.json" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text]
in
  FileName;
shared FolderPath = let
  FolderPath = "personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/IT_Governance/Data_Migrations/Dev/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text]
in
  FolderPath;
shared Query1 = let
	JsonUrl = SharePointSiteUrl & FolderPath & FileName,
  Source = Json.Document(Web.Contents(JsonUrl)),
  #"Converted to table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
  #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to table", "Column1", {"acronym", "atoEffectiveDate", "atoExpirationDate", "belongsTo", "businessOwnerOrg", "businessOwnerOrgComp", "description", "ictObjectId", "id", "name", "oaStatus", "state", "systemMaintainerOrg", "systemMaintainerOrgComp", "uuid", "version"}, {"acronym", "atoEffectiveDate", "atoExpirationDate", "belongsTo", "businessOwnerOrg", "businessOwnerOrgComp", "description", "ictObjectId", "id", "name", "oaStatus", "state", "systemMaintainerOrg", "systemMaintainerOrgComp", "uuid", "version"}),
  #"Changed column type" = Table.TransformColumnTypes(#"Expanded Column1", {{"acronym", type text}, {"atoEffectiveDate", type date}, {"atoExpirationDate", type text}, {"belongsTo", type text}, {"businessOwnerOrg", type text}, {"businessOwnerOrgComp", type text}, {"description", type text}, {"ictObjectId", type text}, {"id", type text}, {"name", type text}, {"oaStatus", type text}, {"state", type text}, {"systemMaintainerOrg", type text}, {"systemMaintainerOrgComp", type text}, {"uuid", type text}, {"version", Int64.Type}}),

  #"Cleaned IDs" = Table.TransformColumns(
    #"Changed column type",
    {
      {"id", each Text.Replace(Text.Replace(_, "{", ""), "}", ""), type text},
      {"uuid", each Text.Replace(Text.Replace(_, "{", ""), "}", ""), type text}
    }
  ),

  // --- DATAVERSE LOOKUP FOR CURRENT BATCH ---
  Dv = CommonDataService.Database(DataverseEnvironmentUrl),
  MigrationRuns = Dv{[Name = "easi_migrationrun", Kind = "Table"]}[Data],
  BufferedRuns = Table.Buffer(MigrationRuns),
  RunningOnly = Table.SelectRows(
    BufferedRuns,
    each [easi_migrationrunstatus] = 100000000
  ),
  Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),
  Latest = Table.FirstN(Sorted, 1),

  BatchId =
    if Table.RowCount(Latest) > 0
    then Text.From(Latest{0}[easi_batchid])
    else "DATAFLOW_NO_RUNNING_BATCH",

  // --- ADD BATCH ID TO OUTPUT ---
  #"Added Batch Id" = Table.AddColumn(#"Cleaned IDs", "migrate_batch_id", each BatchId, type text)

in
  #"Added Batch Id";
