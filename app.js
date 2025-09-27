// Version: 1.2
let video = document.getElementById('webcam');
let startButton = document.getElementById('startButton');
let result = document.getElementById('result');

let posterFeatures;
let boxMapping = {};
let orb, bf;
let scanningInterval;

// Load poster features JSON
async function loadFeatures() {
    const response = await fetch('poster_features.json');
    posterFeatures = await response.json();

    for (let posterId in posterFeatures) {
        boxMapping[posterId] = 3; // All posters in Box 3
    }

    orb = new cv.ORB();
    bf = new cv.BFMatcher(cv.NORM_HAMMING, true);

    result.innerText = "✅ Features loaded! Click 'Start Camera' to begin.";
    startButton.disabled = false;
    startButton.innerText = "Start Camera";
}

// Convert descriptor array to cv.Mat
function arrayToMat(array) {
    let rows = array.length;
    let cols = array[0].length;
    let mat = cv.Mat.zeros(rows, cols, cv.CV_8U);
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
            mat.ucharPtr(i, j)[0] = array[i][j];
    return mat;
}

// Match descriptors
function matchDescriptors(des1, des2) {
    let matches = new cv.DMatchVector();
    bf.match(des1, des2, matches);
    let scores = [];
    for (let i = 0; i < matches.size(); i++) scores.push(matches.get(i).distance);
    scores.sort((a,b) => a-b);
    return scores.slice(0,10).reduce((a,b) => a+b,0);
}

// Scan the poster
function scanPoster() {
    let cap = new cv.VideoCapture(video);
    let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    cap.read(frame);
    cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);

    let kp = new cv.KeyPointVector();
    let des = new cv.Mat();
    orb.detectAndCompute(frame, new cv.Mat(), kp, des);

    if (des.rows === 0) {
        frame.delete(); des.delete(); kp.delete();
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

    frame.delete(); des.delete(); kp.delete();

    if (bestPoster) {
        result.innerText = `Poster: ${bestPoster}, Box: ${boxMapping[bestPoster]}`;
    } else {
        result.innerText = "No match detected yet...";
    }
}

// Start camera and scanning
function startCamera() {
    startButton.disabled = true;
    startButton.innerText = "Starting camera...";

    const constraints = {
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            video.srcObject = stream;
            video.onloadeddata = () => {
                result.innerText = "Camera ready! Scanning...";
                scanningInterval = setInterval(scanPoster, 500);
                startButton.style.display = "none"; // hide the button after starting
            };
        })
        .catch(err => {
            console.warn("Rear camera not available, falling back:", err);
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    video.srcObject = stream;
                    video.onloadeddata = () => {
                        result.innerText = "Camera ready (fallback)! Scanning...";
                        scanningInterval = setInterval(scanPoster, 500);
                        startButton.style.display = "none";
                    };
                })
                .catch(fallbackErr => {
                    console.error("Camera access failed:", fallbackErr);
                    alert("Camera access is required.");
                });
        });
}

// OpenCV runtime ready
cv['onRuntimeInitialized'] = () => {
    loadFeatures();
};

// Button click starts camera
startButton.addEventListener('click', startCamera);
