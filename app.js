// app.js v2.0

let webcamElement = document.getElementById("webcam");
let startButton = document.getElementById("startButton");
let result = document.getElementById("result");

let posterFeatures = {};
let boxMapping = {
    "406": "Box 1",
    "407": "Box 1",
    "408": "Box 2",
    "409": "Box 2",
    "410": "Box 3"
    // expand as needed
};

let orb;
let isReady = false;

// Load stored features
async function loadFeatures() {
    console.log("Attempting to load features...");
    try {
        const response = await fetch("features.json");
        posterFeatures = await response.json();
        console.log("✅ Features loaded:", Object.keys(posterFeatures));
    } catch (err) {
        console.error("❌ Failed to load features:", err);
    }
}

// Convert array → cv.Mat
function arrayToMat(arr) {
    return cv.matFromArray(arr.length, arr[0].length, cv.CV_32F, arr.flat());
}

// Match two descriptors with BFMatcher
function matchDescriptors(des1, des2) {
    if (des1.empty() || des2.empty()) return Infinity;
    let bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    let matches = new cv.DMatchVector();
    bf.match(des1, des2, matches);

    let score = 0;
    for (let i = 0; i < matches.size(); i++) {
        score += matches.get(i).distance;
    }

    bf.delete(); matches.delete();
    return score / Math.max(matches.size(), 1);
}

// Scan a frame for a poster
function scanPoster() {
    if (!posterFeatures || Object.keys(posterFeatures).length === 0) return;

    let cap = new cv.VideoCapture(webcamElement);

    // ✅ Fix: ensure CV_8UC4
    let frame = new cv.Mat(webcamElement.height, webcamElement.width, cv.CV_8UC4);
    cap.read(frame);
    if (frame.empty()) {
        frame.delete();
        return;
    }

    let gray = new cv.Mat();
    cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

    let kp = new cv.KeyPointVector();
    let des = new cv.Mat();
    orb.detectAndCompute(gray, new cv.Mat(), kp, des);

    console.log("Descriptors found:", des.rows);

    if (des.rows === 0) {
        frame.delete(); gray.delete(); des.delete(); kp.delete();
        return;
    }

    let bestPoster = null;
    let bestScore = Infinity;

    for (let posterId in posterFeatures) {
        let descriptorArrays = posterFeatures[posterId];
        for (let arr of descriptorArrays) {
            let mat = arrayToMat(arr);
            let score = matchDescriptors(des, mat);
            mat.delete();
            if (score < bestScore) {
                bestScore = score;
                bestPoster = posterId;
            }
        }
    }

    frame.delete(); gray.delete(); des.delete(); kp.delete();

    if (bestPoster) {
        result.innerText = `Poster: ${bestPoster}, Box: ${boxMapping[bestPoster] || "Unknown"}`;
    } else {
        result.innerText = "Poster not recognized yet...";
    }
}

// Camera start
async function startCamera() {
    const constraints = {
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamElement.srcObject = stream;
        webcamElement.onloadeddata = () => {
            console.log("✅ Camera stream started");
            setInterval(scanPoster, 2000);
        };
    } catch (err) {
        console.warn("Rear camera not available, falling back:", err);
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamElement.srcObject = fallbackStream;
            webcamElement.onloadeddata = () => {
                console.log("✅ Fallback camera started");
                setInterval(scanPoster, 2000);
            };
        } catch (fallbackErr) {
            console.error("Camera access failed:", fallbackErr);
            alert("Camera access is required.");
        }
    }
}

// Start button
startButton.addEventListener("click", async () => {
    if (!isReady) {
        alert("OpenCV not ready yet...");
        return;
    }
    startButton.style.display = "none";
    await startCamera();
});

// Wait for OpenCV to load
cv['onRuntimeInitialized'] = async () => {
    console.log("✅ OpenCV is ready!");
    orb = new cv.ORB();
    isReady = true;
    await loadFeatures();
};
