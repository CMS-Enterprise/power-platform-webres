(function () {
  var ALERT_ID = "itgov-zero-trust-info-alert";
  var STYLE_ID = "itgov-zero-trust-info-alert-styles";
  var FIELD_SELECTOR = '[data-id="cr69a_zerotrustprinciplealignment"]';
  var MAX_ATTEMPTS = 20;
  var RETRY_DELAY_MS = 250;

  function getCandidateDocuments() {
    var documents = [];

    if (window.document) {
      documents.push(window.document);
    }

    if (
      typeof parent !== "undefined" &&
      parent.document &&
      documents.indexOf(parent.document) === -1
    ) {
      documents.push(parent.document);
    }

    var frames = [];
    documents.forEach(function (doc) {
      try {
        frames.push.apply(frames, doc.querySelectorAll("iframe"));
      } catch (error) {
        console.warn(
          "[solutionQuickCreateZeroTrustInfo] unable to inspect iframe list",
          error,
        );
      }
    });

    frames.forEach(function (frame) {
      try {
        var frameDocument =
          frame.contentDocument || frame.contentWindow?.document;
        if (frameDocument && documents.indexOf(frameDocument) === -1) {
          documents.push(frameDocument);
        }
      } catch (error) {
        // Ignore inaccessible frames.
      }
    });

    return documents;
  }

  function findFieldContainer() {
    var documents = getCandidateDocuments();

    for (var index = 0; index < documents.length; index += 1) {
      var doc = documents[index];
      var fieldContainer = doc.querySelector(FIELD_SELECTOR);

      if (fieldContainer) {
        return {
          document: doc,
          fieldContainer: fieldContainer,
        };
      }
    }

    return null;
  }

  function ensureStyles(doc) {
    if (doc.getElementById(STYLE_ID)) {
      return;
    }

    var style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ALERT_ID} {
        margin-top: 12px;
        color: #323130;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      #${ALERT_ID} a {
        color: #005a9e;
        font-weight: 600;
      }

      #${ALERT_ID} a:hover,
      #${ALERT_ID} a:focus {
        color: #004578;
      }
    `;

    doc.head.appendChild(style);
  }

  function createAlert(doc) {
    var container = doc.createElement("p");
    container.id = ALERT_ID;
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.innerHTML = `
      <a
        href="https://security.cms.gov/learn/zero-trust"
        target="_blank"
        rel="noopener noreferrer"
      >Click here</a>
      for more information about Zero Trust and CMS's Zero Trust policies.
    `;

    return container;
  }

  function injectAlert(attempt) {
    var target = findFieldContainer();

    if (!target) {
      if (attempt < MAX_ATTEMPTS) {
        window.setTimeout(function () {
          injectAlert(attempt + 1);
        }, RETRY_DELAY_MS);
      } else {
        console.log(
          "[solutionQuickCreateZeroTrustInfo] target field not found after retries",
        );
      }
      return;
    }

    var doc = target.document;
    var fieldContainer = target.fieldContainer;

    if (doc.getElementById(ALERT_ID)) {
      return;
    }

    ensureStyles(doc);
    fieldContainer.insertAdjacentElement("afterend", createAlert(doc));
    console.log(
      "[solutionQuickCreateZeroTrustInfo] inserted zero trust helper alert",
    );
  }

  window.ITGov_SolutionQuickCreateZeroTrustInfoOnLoad = function () {
    injectAlert(0);
  };
})();
