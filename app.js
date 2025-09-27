function startCamera() {
    if (!orb || !bf) {
        alert("OpenCV not ready yet. Please wait a moment.");
        return;
    }

    const constraints = {
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            video.srcObject = stream;
            video.onloadeddata = () => {
                result.innerText = "Camera ready! Scanning...";
                scanningInterval = setInterval(scanPoster, 500); // scan every 0.5s
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
