/* ==========================================================================
 * PIN OVERLAY FEATURE (박제 기능 전용)
 * ========================================================================== */
(function () {
  var PIN_MAX_COUNT = 3;
  var PIN_DURATION_MS = 5 * 60 * 1000;
  var PIN_IMAGE_SMALL = 84;
  var PIN_IMAGE_LARGE = 132;
  var activePins = [];
  window.__pinObstacles = [];
  console.log("[PIN] pin overlay loaded");

  function normalizeNames(name) {
    var names = Array.isArray(name) ? name : [name];
    return names.filter(function (item) {
      return typeof item === "string" && item.trim().length > 0;
    });
  }

  function selectSinglePinImage(name) {
    var names = normalizeNames(name);
    return names.length > 0 ? names[0] : null;
  }

  function getDcconPath(name) {
    var normalized = name;
    if (!normalized) {
      return "";
    }

    var path = normalized.startsWith("/") ? ("images/dccon" + normalized) : ("images/dccon/" + normalized);
    var lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) {
      return path;
    }

    var dir = path.substring(0, lastSlash + 1);
    var filename = path.substring(lastSlash + 1);
    return dir + encodeURIComponent(filename);
  }

  function findDcconByKeyword(targetKeyword) {
    if (!targetKeyword || !Array.isArray(window.dcConsData)) {
      return null;
    }

    for (var i = 0; i < window.dcConsData.length; i++) {
      var item = window.dcConsData[i];
      if (!item || !Array.isArray(item.keywords)) {
        continue;
      }

      for (var j = 0; j < item.keywords.length; j++) {
        if (item.keywords[j] === targetKeyword) {
          return item;
        }
      }
    }
    return null;
  }

  function findBestDcconByPhrase(phrase) {
    if (!phrase) {
      return null;
    }

    var directMatch = findDcconByKeyword(phrase);
    if (directMatch) {
      return { item: directMatch, keyword: phrase };
    }

    var tokens = phrase.split(/\s+/).filter(function (token) { return token.length > 0; });
    for (var i = tokens.length - 1; i >= 0; i--) {
      var tokenMatch = findDcconByKeyword(tokens[i]);
      if (tokenMatch) {
        return { item: tokenMatch, keyword: tokens[i] };
      }
    }
    return null;
  }

  function parsePinKeyword(message) {
    if (!message) {
      return null;
    }

    var pinIndex = message.indexOf("박제!");
    if (pinIndex === -1) {
      return null;
    }

    var targetText = message.slice(0, pinIndex);
    var keywordMatches = targetText.match(/~([^\s~]+)/g);
    if (!keywordMatches || keywordMatches.length === 0) {
      return null;
    }

    var imageNames = [];
    var detectedKeywords = [];

    keywordMatches.forEach(function (rawKeyword) {
      var userPhrase = rawKeyword.slice(1).trim();
      if (!userPhrase) {
        return;
      }

      var matched = findBestDcconByPhrase(userPhrase);
      if (!matched) {
        console.log("[PIN] keyword not found in dcConsData:", userPhrase);
        return;
      }

      detectedKeywords.push(matched.keyword);
      var singleImage = selectSinglePinImage(matched.item.name);
      if (singleImage) {
        imageNames.push(singleImage);
      }
    });

    if (imageNames.length === 0) {
      return null;
    }

    return {
      keyword: detectedKeywords.join(", "),
      imageNames: imageNames,
      isBig: /커져라!?/.test(message)
    };
  }

  function getRandomPosition(imageCount, imageSize) {
    var cardWidth = 8 + (imageSize * imageCount) + (10 * Math.max(0, imageCount - 1)) + 8;
    var cardHeight = imageSize + 16;
    var maxLeft = Math.max(16, window.innerWidth - cardWidth - 16);
    var maxTop = Math.max(16, window.innerHeight - cardHeight - 16);

    return {
      left: Math.floor(16 + Math.random() * Math.max(1, maxLeft - 16)),
      top: Math.floor(16 + Math.random() * Math.max(1, maxTop - 16))
    };
  }

  function removePin(pinObject) {
    if (!pinObject) {
      return;
    }
    if (pinObject.timeout) {
      clearTimeout(pinObject.timeout);
    }
    if (pinObject.interval) {
      clearInterval(pinObject.interval);
    }
    if (pinObject.element && pinObject.element.parentNode) {
      pinObject.element.parentNode.removeChild(pinObject.element);
    }
    activePins = activePins.filter(function (entry) { return entry !== pinObject; });
    window.__pinObstacles = activePins.map(function (entry) {
      return entry.obstacleRect;
    }).filter(function (rect) { return !!rect; });
  }

  function showPin(pinData, nick) {
    var layer = document.getElementById("pin-layer");
    if (!pinData.imageNames || pinData.imageNames.length === 0) {
      console.log("[PIN] no image to show:", pinData.keyword);
      return;
    }

    if (activePins.length >= PIN_MAX_COUNT) {
      removePin(activePins[0]);
    }

    var card = document.createElement("div");
    card.className = "pin-card";
    var imageSize = PIN_IMAGE_SMALL;
    if (pinData.isBig) {
      card.classList.add("big");
      imageSize = PIN_IMAGE_LARGE;
    }

    var image = document.createElement("img");
    image.className = "pin-image";
    image.alt = "박제 이미지";
    image.src = getDcconPath(pinData.imageNames[0]);
    card.appendChild(image);

    var position = getRandomPosition(1, imageSize);
    card.style.left = position.left + "px";
    card.style.top = position.top + "px";
    layer.appendChild(card);

    var pinObject = {
      element: card,
      timeout: null,
      interval: null,
      obstacleRect: {
        left: position.left,
        top: position.top,
        right: position.left + imageSize + 16,
        bottom: position.top + imageSize + 16
      }
    };

    if (pinData.imageNames.length >= 2) {
      var currentIndex = 0;
      pinObject.interval = setInterval(function () {
        var nextIndex = currentIndex;
        if (pinData.imageNames.length === 2) {
          nextIndex = currentIndex === 0 ? 1 : 0;
        } else {
          while (nextIndex === currentIndex) {
            nextIndex = Math.floor(Math.random() * pinData.imageNames.length);
          }
        }
        currentIndex = nextIndex;
        image.src = getDcconPath(pinData.imageNames[currentIndex]);
      }, 5000);
    }

    pinObject.timeout = setTimeout(function () {
      removePin(pinObject);
      console.log("[PIN] pin hidden after 5 minutes");
    }, PIN_DURATION_MS);
    activePins.push(pinObject);
    window.__pinObstacles = activePins.map(function (entry) {
      return entry.obstacleRect;
    }).filter(function (rect) { return !!rect; });

    console.log("[PIN] showPin:", {
      command: "~" + pinData.keyword + " 박제!",
      nick: nick || "알 수 없음"
    });
  }

  function patchAddChatMessage() {
    if (typeof window.addChatMessage !== "function") {
      return false;
    }
    if (window.__pinPatchApplied) {
      return true;
    }

    var originalAddChatMessage = window.addChatMessage;
    window.addChatMessage = function (nick, message, data) {
      try {
        var detectedNick = nick;
        var detectedMessage = message;
        var detectedData = data;

        if (arguments.length >= 4 && typeof arguments[2] === "string") {
          detectedNick = arguments[1];
          detectedMessage = arguments[2];
          detectedData = arguments[3];
        }

        var rawMessage = detectedMessage || "";
        if (!rawMessage && detectedData && typeof detectedData.message === "string") {
          rawMessage = detectedData.message;
        }

        if (/퍽!/.test(rawMessage)) {
          window.dispatchEvent(new CustomEvent("pin:toy-hit", {
            detail: {
              nick: detectedNick || "",
              message: rawMessage
            }
          }));
        }

        var pinData = parsePinKeyword(rawMessage);
        if (pinData) {
          showPin(pinData, detectedNick);
        }
      } catch (e) {
        console.error("[PIN] hook error:", e);
      }

      return originalAddChatMessage.apply(this, arguments);
    };

    window.__pinPatchApplied = true;
    console.log("[PIN] addChatMessage patch applied");
    return true;
  }

  var retry = setInterval(function () {
    if (patchAddChatMessage()) {
      clearInterval(retry);
      console.log("[PIN] hook ready");
    }
  }, 150);
}());
