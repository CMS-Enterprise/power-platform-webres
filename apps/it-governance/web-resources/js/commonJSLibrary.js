console.log("Common JS library loaded");

parent.lockAllFields = function (formContext) {
  if (!formContext) {
    console.warn("lockAllFields: No form context provided.");
    return;
  }

  let lockedCount = 0;
  const subgridsFound = [];

  // Disable all attribute-based controls
  formContext.data.entity.attributes.forEach((attr) => {
    attr.controls.forEach((ctrl) => {
      try {
        ctrl.setDisabled(true);
        lockedCount++;
      } catch (e) {
        console.error("Failed to disable control", ctrl.getName(), e);
      }
    });
  });

  // Find and handle ALL subgrids automatically
  formContext.ui.controls.forEach((control) => {
    // Check if this control is a subgrid
    if (control.getControlType && control.getControlType() === "subgrid") {
      const gridName = control.getName();
      subgridsFound.push(gridName);

      console.log(`Found subgrid: ${gridName}`);

      // Hook into the subgrid's onLoad event
      control.addOnLoad(function () {
        setTimeout(() => {
          const commandBars = window.parent.document.querySelectorAll(
            '[data-id*="commandBar"]'
          );

          commandBars.forEach((bar) => {
            bar.style.display = "none";
          });
        }, 500);
      });
    }
  });

  console.log(
    `Locked ${lockedCount} field controls and found ${subgridsFound.length} subgrids:`,
    subgridsFound
  );
};
