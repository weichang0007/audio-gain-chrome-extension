let contnetElement = document.getElementById("content");
let videoNotFoundElement = document.getElementById("video-not-found");
let gainElement = document.getElementById("gain");
let gainDisplay = document.getElementById("gain-display");

if (window.louderContext) {
  alert("test");
  if (window.louderContext.gainNode) {
    alert("test");
    let currentGain = window.louderContext.gain.value;
    gainDisplay.innerHTML = currentGain;
    gainElement.value = currentGain;
  }
}

(async function init() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: hasVideoTag,
    },
    (frameResults) => {
      for (let frameResult of frameResults) {
        let hasVideoTag = frameResult.result;
        if (hasVideoTag) {
          contnetElement.style.display = "unset";
          videoNotFoundElement.style.display = "none";
        } else {
          contnetElement.style.display = "none";
          videoNotFoundElement.style.display = "unset";
        }
      }
    }
  );

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: getCurrentGain,
    },
    (frameResults) => {
      for (let frameResult of frameResults) {
        let currentGain = parseFloat(frameResult.result.toString()).toFixed(1);
        gainDisplay.innerHTML = currentGain;
        gainElement.value = currentGain;
      }
    }
  );
})();

function hasVideoTag() {
  return document.querySelector("video") != null;
}

function getCurrentGain() {
  if (
    window.louderContext != undefined &&
    window.louderContext.gainNode != undefined
  ) {
    return window.louderContext.gainNode.gain.value;
  }
  return 1;
}

gainElement.addEventListener("change", onGainChange);

async function onGainChange(event) {
  let targetGain = event.target.value;
  gainDisplay.innerHTML = targetGain;
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectGain,
    args: [targetGain],
  });
}

function injectGain(targetGain) {
  if (window.louderContext == null) {
    window.louderContext = {};
  }

  if (window.louderContext.gainNode) {
    let audioContext = window.louderContext.audioContext;
    let gainNode = window.louderContext.gainNode;
    gainNode.gain.setValueAtTime(targetGain, audioContext.currentTime + 0.1);
    return;
  }

  let audioContext = new AudioContext();
  let mediaElementSource = audioContext.createMediaElementSource(
    document.querySelector("video")
  );
  let gainNode = audioContext.createGain();
  gainNode.gain.value = targetGain;

  var limiterNode = audioContext.createDynamicsCompressor();
  // Creating a compressor but setting a high threshold and
  // high ratio so it acts as a limiter. More explanation at
  // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode
  limiterNode.threshold.setValueAtTime(-5.0, audioContext.currentTime); // In Decibels
  limiterNode.knee.setValueAtTime(0, audioContext.currentTime); // In Decibels
  limiterNode.ratio.setValueAtTime(40.0, audioContext.currentTime); // In Decibels
  limiterNode.attack.setValueAtTime(0.001, audioContext.currentTime); // Time is seconds
  limiterNode.release.setValueAtTime(0.1, audioContext.currentTime); // Time is seconds

  mediaElementSource.connect(gainNode);
  gainNode.connect(limiterNode);
  limiterNode.connect(audioContext.destination);

  window.louderContext.gainNode = gainNode;
  window.louderContext.audioContext = audioContext;
}
