(function () {
  "use strict";

  browser.action.onClicked.addListener(() => {
    browser.sidebarAction.toggle();
  });
})();
