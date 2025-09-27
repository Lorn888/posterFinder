let video = document.getElementById('camera');
let result = document.getElementById('result');
let posterFeatures;
let boxMapping = {};
let orb, bf;

async function loadFeatures() {
    const response = await fetch('poster_features.json');
    posterFeatures = await response.json();

    // Map all posters in box 3
    for (let posterId in posterFeatures) {
        boxMapping[posterId] = 3;
    }

    // Initialize ORB and BFMatcher
    orb = new cv.ORB();
    bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
}

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => console.error(err));
}

function arrayToMat(array) {
    // Convert JS array to cv.Mat (uint8)
    let rows = array.length;
    let cols = array[0].length;
    let mat = cv.Mat.zeros(rows, cols, cv.CV_8U);
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
            mat.ucharPtr(i, j)[0] = array[i][j];
    return mat;
}

function matchDescriptors(des1, des2) {
    let matches = new cv.DMatchVector();
    bf.match(des1, des2, matches);
    let scores = [];
    for (let i = 0; i < matches.size(); i++) {
        scores.push(matches.get(i).distance);
    }
    scores.sort((a,b) => a-b);
    return scores.slice(0,10).reduce((a,b) => a+b,0); // sum of 10 best
}

function scanPoster() {
    let cap = new cv.VideoCapture(video);
    let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    cap.read(frame);
    cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);

    // Detect keypoints and descriptors
    let kp = new cv.KeyPointVector();
    let des = new cv.Mat();
    orb.detectAndCompute(frame, new cv.Mat(), kp, des);

    if (des.rows === 0) {
        result.innerText = "Could not detect poster.";
        frame.delete(); des.delete(); kp.delete();
        return;
    }

    let bestPoster = null;
    let bestScore = Infinity;

    // Compare with all posters in JSON
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
        result.innerText = "No match found.";
    }
}

// Load OpenCV, features, start camera
cv['onRuntimeInitialized'] = () => {
    loadFeatures().then(startCamera);
}

document.getElementById('scanBtn').addEventListener('click', scanPoster);