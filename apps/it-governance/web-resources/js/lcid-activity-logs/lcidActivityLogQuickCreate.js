const LCID_ACTIVITY_TYPES = {
  Retire: 100000000,
  Unretire: 100000001,
  Update: 100000002,
  Issue: 100000003,
  Expire: 100000004,
  Confirm: 100000005,
  UpdateRetirementDate: 100000006,
  ExpirationAlert: 100000007,
};

const LCID_ACTIVITY_FORM_TITLES = {
  100000000: "Retire",
  100000001: "Un-retire",
  100000002: "Update",
  100000003: "Issue",
  100000004: "Expire",
  100000005: "Confirm",
  100000006: "Update Retirement Date",
  100000007: "Expiration Alert",
};

const LCID_ACTIVITY_LOG_TITLES = {
  100000000: "Retired",
  100000001: "Un-retired",
  100000002: "Updated",
  100000003: "Issued",
  100000004: "Expired",
  100000005: "Confirmed",
  100000006: "Retirement Date Updated",
  100000007: "Expiration Alert",
};

// All fields managed by the quick create rules
const ALL_FIELDS = [];

// Config per activity type - to be filled in
const TYPE_RULES = {
  [LCID_ACTIVITY_TYPES.Retire]: {
    show: [],
    hide: [],
    require: [],
  },
};

function onLoad(executionContext) {
  const formContext = executionContext.getFormContext();

  applyRules(formContext);

  if (typeof updateLifecycleIdSelectionVisibility === "function") {
    updateLifecycleIdSelectionVisibility(formContext);
  }
}

function applyRules(formContext) {
  const attr = formContext.getAttribute("new_activitytype");
  const activityType = attr ? attr.getValue() : null;
  const rules = TYPE_RULES[activityType];

  // Baseline: everything managed is not required and hidden
  ALL_FIELDS.forEach((fieldName) => {
    setRequired(formContext, fieldName, false);
    setVisible(formContext, fieldName, false);
  });

  if (!rules) {
    // Unknown type: show generic notes and set default title
    setVisible(formContext, "new_additionalinformation", true);
    setVisible(formContext, "new_adminnote", true);
    setLCIDActivityLogTitleUnsafe(
      LCID_ACTIVITY_FORM_TITLES[activityType] || "LCID Activity",
    );
    return;
  }

  // Show
  (rules.show || []).forEach((fieldName) =>
    setVisible(formContext, fieldName, true),
  );

  // Require (and ensure visible)
  (rules.require || []).forEach((fieldName) => {
    setVisible(formContext, fieldName, true);
    setRequired(formContext, fieldName, true);
  });

  // Hide overrides (and drop requirement)
  (rules.hide || []).forEach((fieldName) => {
    setRequired(formContext, fieldName, false);
    setVisible(formContext, fieldName, false);
  });

  setLCIDActivityLogTitleUnsafe(
    LCID_ACTIVITY_FORM_TITLES[activityType] || "LCID Activity",
  );
}

function setVisible(formContext, logicalName, visible) {
  const ctrl = formContext.getControl(logicalName);
  if (!ctrl) return;
  ctrl.setVisible(visible);
}

function setRequired(formContext, logicalName, required) {
  const attr = formContext.getAttribute(logicalName);
  if (!attr) return;
  attr.setRequiredLevel(required ? "required" : "none");
}

function setLCIDActivityLogTitleUnsafe(title) {
  const MAX_ATTEMPTS = 15; // ~1.5s total
  const DELAY_MS = 100;
  let attempts = 0;

  const trySet = () => {
    attempts++;
    let header =
      document.querySelector("[data-id='quickHeaderTitle']") ||
      document.querySelector("[data-id='header_title']");

    if (!header && typeof parent !== "undefined" && parent.document) {
      header =
        parent.document.querySelector("[data-id='quickHeaderTitle']") ||
        parent.document.querySelector("[data-id='header_title']");
    }

    if (!header && typeof parent !== "undefined" && parent.document) {
      // Inspect iframes cautiously
      const frames = [
        ...document.querySelectorAll("iframe"),
        ...parent.document.querySelectorAll("iframe"),
      ];
      for (const frame of frames) {
        try {
          const d = frame.contentDocument || frame.contentWindow?.document;
          if (!d) continue;
          header =
            d.querySelector("[data-id='quickHeaderTitle']") ||
            d.querySelector("[data-id='header_title']");
          if (header) break;
        } catch (_) {}
      }
    }

    if (header) {
      header.textContent = title;
      setTimeout(() => {
        if (header && header.textContent !== title) header.textContent = title;
      }, 250);
      return;
    }
    if (attempts < MAX_ATTEMPTS) setTimeout(trySet, DELAY_MS);
  };

  setTimeout(trySet, 50);
}
