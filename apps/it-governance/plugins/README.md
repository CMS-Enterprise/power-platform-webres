# Plugins

This directory contains Dataverse plugins specific to the IT Governance application.

Each plugin should live in its own folder and include:

- Source code
- Project file (`.csproj`)
- Strong name key (`.snk`)
- A README describing behavior and registration details

## Expectations

Plugin folders should document:

- Message (Create, Update, etc.)
- Primary entity
- Execution stage (Pre/Post Operation)
- Sync vs async
- Any important assumptions or edge cases

This helps future developers understand and safely modify plugin behavior.

# Plugin Development Guide

## 1. Prereqs

- Visual Studio (or VS Code) with .NET tooling
- Plug-in Registration Tool (PRT) - We've found success using the PRT in XRM Toolkit
- Access to the DEV Dataverse environment
- The target solution (unmanaged in DEV)
- Dataverse plug-ins are .NET assemblies and must target the supported .NET Framework version for plug-ins (At the time of this writing we had to use .NET Framework 4.7.1).

## 2. Build the plug-in project

- Create a Class Library (.NET Framework) plug-in project
- Implement IPlugin in your plug-in class(es)
- Add needed NuGet packages (SDK assemblies your template uses)
- Build the project to produce the compiled output (DLL)
- Reference: “Write a plug-in” describes the IPlugin pattern and compilation model.
- Recommended conventions:
  - One assembly per “logical plugin package” (e.g., SystemIntake.Plugins)
  - Name your classes by behavior (e.g., LcidGenerationPlugin, LockFieldsOnSubmitPlugin)
  - Use tracing (ITracingService) and fail fast with clear errors for invalid data

## 3. Register the assembly + steps in DEV (PRT)

- Use the Plug-in Registration Tool (XrmToolBox / PRT):
- Connect to DEV Dataverse environment
- Register (or update) the plug-in assembly (upload the DLL)
- Create the Step (message + table + stage + sync/async)
- Add images/config if needed (pre/post entity images, secure/unsecure config)
- Rule of thumb:
  - First-time registration: Register assembly → register steps
  - Updates: Update the assembly (keep the same assembly identity), verify steps still correct

## 4. Add the plug-in components to the solution (in DEV)

- In the Maker portal (Solutions) or via PRT options:
- Add Plug-in Assembly to solution
  - Add Existing > More > Developer > Plug-in assembly
- Add SDK Message Processing Step(s) (your steps)
  - Add Existing > More > Developer > Plug-in step
- Add any related components the plug-in depends on (tables, columns, security roles, etc.)
- This is what makes it deployable via solution import / Pipelines. Microsoft documents packaging plug-ins in solutions for distribution.

## 5. Deploy via Pipelines (DEV → TEST → PROD)

- Commit solution changes (if using source control)
- Run Power Platform Pipeline to promote the solution
- In TEST/PROD, verify:
- Assembly exists
- Steps exist and are enabled
- Expected behavior occurs on the event trigger
- (You do not manually re-upload the DLL per environment if it’s correctly included in the solution.)

## 6. Verification checklist (post-deploy)

- [ ] Correct step message/table (e.g., Create/Update on the right Dataverse table)

- [ ] Correct pipeline stage (PreOperation / PostOperation, etc.)

- [ ] Correct execution mode (Sync vs Async)

- [ ] Trace logs / plugin logs available for troubleshooting

- [ ] No missing dependent components (tables/columns/relationships)

## 7. Common pitfalls

- Forgetting to include steps in the solution (assembly deploys but nothing fires)
- Registering in DEV but never adding to the solution (so Pipelines won’t carry it)
- Changing assembly name/namespace causing “new” assembly instead of upgrade
- Confirm that Trace Logging is enabled in the target environments
- Differences in security/connection references between environments
- Optional: Alternative approach (PAC CLI “plug-in package”)
- Microsoft also supports creating and registering plug-in packages with PAC CLI (more DevOps-friendly), but your current “PRT + solution” method is totally valid and common.
