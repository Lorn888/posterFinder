// Version 2.1

let webcamElement = document.getElementById("webcam");
let startButton = document.getElementById("startButton");
let result = document.getElementById("result");

let posterFeatures = {}; // To load your poster descriptors
let boxMapping = {};
let orb, bf;
let scanningInterval;

// ✅ OpenCV ready callback
cv['onRuntimeInitialized'] = async () => {
    console.log("✅ OpenCV is ready!");

    // Load poster features JSON
    await loadFeatures();

    startButton.disabled = false;
    result.innerText = "✅ Features loaded! Click 'Start Camera' to begin.";
};

// Load poster features from JSON
async function loadFeatures() {
    try {
        console.log("Attempting to load features...");
        const response = await fetch("poster_features.json");
        if (!response.ok) throw new Error("HTTP error " + response.status);

        posterFeatures = await response.json();
        console.log("✅ Features loaded:", Object.keys(posterFeatures));

        // Map all posters to box 3 for now
        for (let posterId in posterFeatures) {
            boxMapping[posterId] = 3;
        }

        // Initialize ORB detector and BFMatcher
        orb = new cv.ORB();
        bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    } catch (err) {
        console.error("❌ Failed to load features:", err);
        result.innerText = "❌ Could not load features. Check console.";
    }
}

// Convert array to cv.Mat
function arrayToMat(arr) {
    let rows = arr.length;
    let cols = arr[0].length;
    let mat = new cv.Mat(rows, cols, cv.CV_8U);
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
            mat.ucharPtr(i, j)[0] = arr[i][j];
    return mat;
}

// Match descriptors
function matchDescriptors(des1, des2) {
    let matches = new cv.DMatchVector();
    bf.match(des1, des2, matches);
    let scores = [];
    for (let i = 0; i < matches.size(); i++) scores.push(matches.get(i).distance);
    scores.sort((a, b) => a - b);
    return scores.slice(0, 10).reduce((a, b) => a + b, 0);
}

// Scan current frame from webcam
function scanPoster() {
    if (!posterFeatures || Object.keys(posterFeatures).length === 0) return;

    let cap = new cv.VideoCapture(webcamElement);
    let frame = new cv.Mat();
    cap.read(frame);

    if (frame.empty()) {
        frame.delete();
        console.warn("⚠️ Empty frame from camera");
        return;
    }

    console.log("Frame type:", frame.type()); // 🔹 Check type (should be 24 / CV_8UC4)

    cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);

    let kp = new cv.KeyPointVector();
    let des = new cv.Mat();
    orb.detectAndCompute(frame, new cv.Mat(), kp, des);

    console.log("Keypoints:", kp.size(), "Descriptors:", des.rows); // 🔹 Debug

    if (des.rows === 0) {
        frame.delete(); des.delete(); kp.delete();
        result.innerText = "⚠️ No features found in frame";
        return;
    }

    let bestPoster = null;
    let bestScore = Infinity;

    for (let posterId in posterFeatures) {
        let descriptorArrays = posterFeatures[posterId];
        for (let arr of descriptorArrays) {
            let mat = arrayToMat(arr);
            let score = matchDescriptors(des, mat);

            console.log(`Poster ${posterId} score: ${score}`); // 🔹 Debug

            mat.delete();
            if (score < bestScore) {
                bestScore = score;
                bestPoster = posterId;
            }
        }
    }

    frame.delete(); des.delete(); kp.delete();

    if (bestPoster && bestScore < 500) { // threshold, adjust as needed
        result.innerText = `Poster: ${bestPoster}, Box: ${boxMapping[bestPoster]} (score: ${bestScore})`;
    } else {
        result.innerText = `Poster not recognized (best score: ${bestScore})`;
    }
}

// Start camera
async function startCamera() {
    const constraints = {
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamElement.srcObject = stream;
        webcamElement.onloadeddata = () => {
            startButton.style.display = "none";
            result.innerText = "Camera ready! Scanning...";
            scanningInterval = setInterval(scanPoster, 1000);
        };
    } catch (err) {
        console.warn("Rear camera not available, falling back:", err);
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            webcamElement.srcObject = fallbackStream;
            webcamElement.onloadeddata = () => {
                startButton.style.display = "none";
                result.innerText = "Camera ready (fallback)! Scanning...";
                scanningInterval = setInterval(scanPoster, 1000);
            };
        } catch (fallbackErr) {
            console.error("Camera access failed:", fallbackErr);
            alert("Camera access is required to use this app.");
        }
    }
}

// Button click
startButton.addEventListener("click", startCamera);
