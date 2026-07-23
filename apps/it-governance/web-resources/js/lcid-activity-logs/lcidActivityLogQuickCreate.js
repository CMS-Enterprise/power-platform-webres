const LCID_ACTIVITY_TYPES = {
  Retire: 100000000,
  Unretire: 100000001,
  Update: 100000002,
  Issue: 100000003,
  Expire: 100000004,
  Confirm: 100000005,
  UpdateRetirementDate: 100000006,
  ExpirationAlert: 100000007,
  Edit: 100000008,
};

const ACTIVITY_TYPE_FIELD = "new_activitytype";
const LCID_LOOKUP_FIELD = "new_lcid";
const LCID_ENTITY_NAME = "cr69a_lifecycleids";

const LCID_ACTIVITY_FORM_TITLES = {
  100000000: "Retire",
  100000001: "Un-retire",
  100000002: "Update",
  100000003: "Issue",
  100000004: "Expire",
  100000005: "Confirm",
  100000006: "Update Retirement Date",
  100000007: "Expiration Alert",
  100000008: "Edit",
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
  100000008: "Edited",
};

// All fields managed by the quick create rules
const ALL_FIELDS = [
  "new_lcidcostbaseline",
  "new_lcidscope",
  "new_lcidexpirationdate",
  "new_lcidretiredate",
  "new_lcidtype",
  "new_lcidislowit",
  "new_lcidisshortened",
  "new_lcidcomponent",
];

const EDIT_LCID_PREFILL_FIELDS = [
  "new_lcidtype",
  "new_lcidislowit",
  "new_lcidisshortened",
  "new_lcidcomponent",
];

// Config per activity type - to be filled in
const TYPE_RULES = {
  [LCID_ACTIVITY_TYPES.Retire]: {
    show: [],
    hide: [],
    require: [],
  },
  [LCID_ACTIVITY_TYPES.Edit]: {
    show: ALL_FIELDS,
    hide: [],
    require: [],
  },
};

function onLoad(executionContext) {
  const formContext = executionContext.getFormContext();
  const activityTypeAttribute = formContext.getAttribute(ACTIVITY_TYPE_FIELD);
  const lcidAttribute = formContext.getAttribute(LCID_LOOKUP_FIELD);

  applyRules(formContext);
  populateEditFieldsFromLcid(formContext);

  activityTypeAttribute?.addOnChange(() => {
    applyRules(formContext);
    populateEditFieldsFromLcid(formContext);
  });

  lcidAttribute?.addOnChange(() => populateEditFieldsFromLcid(formContext));

  if (typeof updateLifecycleIdSelectionVisibility === "function") {
    updateLifecycleIdSelectionVisibility(formContext);
  }
}

function applyRules(formContext) {
  const attr = formContext.getAttribute(ACTIVITY_TYPE_FIELD);
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

async function populateEditFieldsFromLcid(formContext) {
  const activityType = formContext
    .getAttribute(ACTIVITY_TYPE_FIELD)
    ?.getValue();

  if (activityType !== LCID_ACTIVITY_TYPES.Edit) return;

  const lcidId = getLookupId(formContext, LCID_LOOKUP_FIELD);
  if (!lcidId || typeof Xrm === "undefined" || !Xrm.WebApi?.retrieveRecord) {
    return;
  }

  try {
    const select = EDIT_LCID_PREFILL_FIELDS.join(",");
    const lcid = await Xrm.WebApi.retrieveRecord(
      LCID_ENTITY_NAME,
      lcidId,
      `?$select=${select}`,
    );

    EDIT_LCID_PREFILL_FIELDS.forEach((fieldName) => {
      if (Object.prototype.hasOwnProperty.call(lcid, fieldName)) {
        setAttributeValue(formContext, fieldName, lcid[fieldName] ?? null);
      }
    });
  } catch (error) {
    console.warn(
      "[lcidActivityLogQuickCreate] Unable to prefill LCID edit fields.",
      error,
    );
  }
}

function getLookupId(formContext, logicalName) {
  const value = formContext.getAttribute(logicalName)?.getValue();
  const first = Array.isArray(value) ? value[0] : null;
  return first?.id ? String(first.id).replace(/[{}]/g, "") : null;
}

function setAttributeValue(formContext, logicalName, value) {
  const attr = formContext.getAttribute(logicalName);

  if (!attr || attr.getIsDirty?.() || attr.getValue() === value) return;

  attr.setValue(value);
  attr.fireOnChange?.();
}
