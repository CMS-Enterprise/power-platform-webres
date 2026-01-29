# Shared Power Platform Resources

This folder is reserved for **truly reusable Power Platform assets** that are intended to be shared across multiple applications and environments.

At the time of creation, most code in this repository is **app-specific** and lives under the relevant `/apps/<app-name>/` directory. That is intentional.

## What belongs here

Only place assets in this folder when they meet **most or all** of the following criteria:

- Used by **more than one app**
- Not tightly coupled to a single Dataverse table or form
- Has a clear, stable interface
- Would reasonably be maintained and versioned independently
- Has documentation explaining how to consume it

Examples of good candidates:

- PCF controls
- Reusable React components used by multiple Power Pages or model-driven apps
- Shared CSS or design system tokens
- Generic JavaScript utilities (date handling, formatting, validation)
- Cross-app form components or UI widgets
- Shared plugin helpers or base classes

## What does _not_ belong here

- App-specific form logic
- One-off plugins or migrations
- Scripts that reference a single app’s tables or fields
- Experimental or in-progress code

If a component is only used by one app today, it should live in that app’s folder until reuse is proven.

## Promoting code to `shared`

When code becomes reusable:

1. Copy or move it into an appropriate subfolder under `shared/`
2. Add or update documentation explaining:
   - What the component does
   - How it is consumed
   - Any configuration or dependencies
3. Update consuming apps to reference the shared version

Premature abstraction is discouraged. Reuse should be intentional, not aspirational.
