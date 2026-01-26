// ScreenMain.OnVisible
If(
  IsBlank(varDidInit),
  Set(varDidInit, true);          // run once per open

  // Read params safely
  Set(varRecordIdText, Coalesce(Param("recordId"), Param("systemIntakeId")));
  Set(varEntityName,  Coalesce(Param("entityName"), "cr69a_systemintake"));
  Set(
    varRecordId,
    IfError(
      If(!IsBlank(varRecordIdText), GUID(varRecordIdText), Blank()),
      Blank()
    )
  );

  // Optional: default your tab if you use container "pages"
  If(IsBlank(varTab), Set(varTab, "overview"));

  // Optional: load the record (adjust names to your table)
  Set(
    varSystemIntake,
    If(
      !IsBlank(varRecordId),
      IfError(
        LookUp(SystemIntakes, SystemIntake = varRecordId), // or LookUp('System Intakes','System Intake'=varRecordId)
        Blank()
      ),
      Blank()
    )
  )
);
