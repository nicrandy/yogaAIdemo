

const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const nonReversedCanvasElement = document.getElementsByClassName('nonReversed_output_canvas')[0];
const nonReversedCanvasCtx = nonReversedCanvasElement.getContext('2d');
const targetPoseCanvasElement = document.getElementsByClassName('target_pose_canvas')[0];
const targetPoseCanvasCtx = targetPoseCanvasElement.getContext('2d');
const bestPoseCanvasElement = document.getElementsByClassName('best_pose_canvas')[0];
const bestPoseCanvasCtx = bestPoseCanvasElement.getContext('2d');
const timer = document.getElementById("timer");
const scoreBoard = document.getElementById("score");

// ---------  START global variables ---------- //
var allYogaPoseInfo = []; // load from json file of pose info
var currentLandmarksArray = []; // live update of output landmarks
var currentScore = 0; // live update of current score
var thisWorkoutSchedule = []; // array of poses related to images in example_poses
var totalPosesInThisWorkout = 0; // set the total number of poses to do for this workout
var currentPoseInThisWorkout = 1; // start with pose 1
var thisPoseHighScore = 0; // track this pose current high score
var currentInputImage = null; // save the corrent input image
///// set workoutStarted to true to skip the menu
var workoutStarted = false; // draw selection circles if workout not started yet
var testing = false; // for testing, skips menu and starts workout
//////////////////////////////////////////////////

var saveDataToArray = true; // set to true to save workout data to array
// track progress through the selection menu, eg. choose workout, timing etc. stage
// 0 = initial instructions
// 1 = choose workout
// 2 = choose timing
// 3 = choose number of poses to do pose
var menuTracker = 0;

var displayUserVideoOutput = true; // to display the video output from the camera
var displayLandmarkLines = true; // to draw the landmarks on the display
var displayLandmarkCircles = true; // to draw circles on landmark locations
var fitUserLandmarksToCanvas = true; // fit the user landmarks so they are all displayed on the canvas

// ---------  END global variables ---------- //

// function to get session ID from URL
function getSessionID() {
    var url = window.location.href;
    var sessionID = url.split("=")[1];
    console.log("sessionID: " + sessionID);
    return sessionID;
}

// from json file, includes image file location, name and pose angles
function loadJSON(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'poseInfo2.json', true);
    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
            // .open will NOT return a value but simply returns undefined in async mode so use a callback
            callback(xobj.responseText);
        }
    }
    xobj.send(null);
}
// Call to function with anonymous callback
loadJSON(function (response) {
    // Do Something with the response e.g.
    allYogaPoseInfo = JSON.parse(response);
    // Assuming json data is wrapped in square brackets as Drew suggests
    i = 0;
    while (i < allYogaPoseInfo.length) {
        // console.log(allYogaPoseInfo[i]);
        i++;
    }
});

function onResults(results) {
    currentInputImage = results.image;

    if (!results.poseLandmarks) {
        return;
    }
    // ------ all of the actions to perform when there are results
    currentLandmarksArray = convertLandmarkObjectToArray(results.poseLandmarks); // convert landmarks obj to array
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // clear canvas
    if (displayUserVideoOutput) {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height); // draw camera input image
    }


    // for segmentation mask
    if (results.segmentationMask) {
        canvasCtx.globalCompositeOperation = 'lighter';
        canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
    }
    if (displayLandmarkLines) {
        drawLandmarkLines(currentLandmarksArray); // draw landmarks on canvas
        // drawLandmarkCircles(currentLandmarksArray); // draw circles on landmarks on canvas
    }

    // actions to prerform before starting workout
    if (!workoutStarted) {
        if (testing) {
            /////////////// for testing without menu first ///////////////
            thisWorkoutSchedule = setYogaRoutine(1, 10);
            startWorkout(10); // start workout (timerPerPose)
            workoutStarted = true;
            // clear this canvas and hide instructions
            nonReversedCanvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // clear canvas
            document.getElementById("instructions").style.visibility = "hidden";
            document.getElementById("menu").style.visibility = "hidden";
            ///////////////////////////////////////////////////////////
        }
        else {



            /////////////// for testing with menu first. uncomment to use selection menu ///////////////
            if (menuTracker == 0) {
                drawSelectionCircles(results.poseLandmarks); // draw selection circles until workout starts
            }
            else {
                drawSelectionMenu(currentLandmarksArray); // draw selection menu
            }
        }



    }
    // actions to perform during workout
    if (workoutStarted) {
        updateYogaPoseCanvases(); // update the yoga pose canvases
        let userAngles = CalculateAllAngles(results.poseLandmarks); // calculate angles for current user pose
        let currentPose = thisWorkoutSchedule[currentPoseInThisWorkout - 1]; // get current pose from thisWorkoutSchedule
        let targetAngles = allYogaPoseInfo[currentPose].Angles; // calculate angles for current target pose
        let angleDifferenceScore = CalculateAngleDifferences(userAngles, targetAngles, 10); // calculate angle differences

        updateScore(angleDifferenceScore); // update score on score DOM element
        drawTargetPoseLandmarkLines(); // draw target pose landmarks on canvas
        // start saving data to array
        if (saveDataToArray) {
            let dataInterval = setInterval(dataToSave, 100);
            saveDataToArray = false;
        }
        ///// testing /////
        // updateHighScoreData(results.image, angleDifferenceScore);
        // bestPoseCanvasCtx.drawImage(results.image, 0, 0, 320, 180);
    }
    // ------ end of actions to preform when there are results
}

const pose = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
    },
    width: 1280,
    height: 720
});
camera.start();

// capture still image from camera
function captureImage() {
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    // save image to file
    let imageData = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    let image = new Image();
    image.src = canvasElement.toDataURL("image/png");
    image.width = canvasElement.width;
    image.height = canvasElement.height;
    // let imageName = "image" + currentPoseInThisWorkout + ".png";
    // image.download = imageName;
    // image.click();
}

// take in landmarks and convert to 2D array [x,y,z,visibility]
// 32 landmarks with 4 numerical locations each
function convertLandmarkObjectToArray(landmarks) {
    let landmarkArray = [];
    for (let i = 0; i < landmarks.length; i++) {
        landmarkArray.push([landmarks[i].x, landmarks[i].y, landmarks[i].z, landmarks[i].visibility]);
    }
    return landmarkArray;
}

// set the yoga rotine
// input the workout and number of poses to do for that workout
function setYogaRoutine(workout, poseTotal) {
    totalPosesInThisWorkout = poseTotal;
    let onlyStandingRotine = [8, 18, 21, 22, 31, 36, 39, 60, 68, 74, 75, 76]
    let easyOnTheGround = [1, 3, 7, 9, 10, 12, 15, 16, 17, 20, 29, 30, 33, 34, 37, 38, 44, 48, 52, 56, 57, 59, 65, 67, 71, 73, 80]
    let easyStretch = [3, 5, 9, 10, 17, 21, 29, 34, 40, 45, 48, 49, 52, 72, 76]
    // select amount from each array
    let selectedArray = [];
    if (workout == 1) {
        selectedArray = onlyStandingRotine;
    }
    else if (workout == 2) {
        selectedArray = easyOnTheGround;
    }
    else if (workout == 3) {
        selectedArray = easyStretch;
    }

    let amount = poseTotal;
    let thisWorkout = selectedArray.sort(() => Math.random() - 0.5).slice(0, amount);
    console.log("this workout schedule: ", thisWorkout)
    return thisWorkout;
}


// draw lines between landmarks and circles on landmark locations
function drawLandmarkLines(landmarks) {
    // normalize the landmarks from 0-1  
    if (fitUserLandmarksToCanvas) {

    }
    // connections to draw based on Blazepose model card
    let connections = [[11, 13], [13, 15], [15, 19], [12, 14], [14, 16], [16, 20], [12, 11], [12, 24], [11, 23], [23, 24], [23, 25], [24, 26], [26, 28], [25, 27], [27, 31], [28, 32]];
    connections.forEach(function (item, index) {
        let xStart = Math.round(landmarks[item[0]][0] * canvasElement.width);
        let yStart = Math.round(landmarks[item[0]][1] * canvasElement.height);
        let yFinish = Math.round(landmarks[item[1]][1] * canvasElement.height);
        let xFinish = Math.round(landmarks[item[1]][0] * canvasElement.width);
        canvasCtx.beginPath();
        canvasCtx.moveTo(xStart, yStart);
        if (item[0] == 12 && item[1] == 11 || item[0] == 23 && item[1] == 24) {
            canvasCtx.strokeStyle = 'blue';
        }
        else if (item[0] % 2 == 0) {
            canvasCtx.strokeStyle = 'red';
        }
        else {
            canvasCtx.strokeStyle = 'green';
        }
        canvasCtx.lineWidth = 10;
        canvasCtx.lineCap = 'round';
        canvasCtx.lineTo(xFinish, yFinish);
        canvasCtx.stroke();

        canvasCtx.beginPath();
        canvasCtx.moveTo(xStart, yStart);
        if (item[0] == 12 && item[1] == 11 || item[0] == 23 && item[1] == 24) {
            canvasCtx.strokeStyle = 'lightblue';
        }
        else if (item[0] % 2 == 0) {
            canvasCtx.strokeStyle = 'orange';
        }
        else {
            canvasCtx.strokeStyle = 'lightgreen'
        }
        canvasCtx.lineWidth = 2;
        canvasCtx.lineCap = 'round';
        canvasCtx.lineTo(xFinish, yFinish);
        canvasCtx.stroke();
    });
    if (displayLandmarkCircles) {
        for (let i = 0; i < landmarks.length; i++) {
            const landmark = landmarks[i];
            const x = landmark[0] * canvasElement.width;
            const y = landmark[1] * canvasElement.height;
            let circleDiameter = 10;
            if (i == 0) {
                canvasCtx.fillStyle = 'lightgreen';
                canvasCtx.strokeStyle = 'green';
                // get the distance between points in 2d space
                let distance = Math.sqrt(Math.pow(landmarks[11][0] - landmarks[12][0], 2) + Math.pow(landmarks[11][1] - landmarks[12][1], 2));
                distance = parseInt(distance * canvasElement.width / 3.5);
                circleDiameter = distance;
                // draw the countdown timer on the head circle
                timerXLocation = (1-(x / canvasElement.width)) * 95;
                timerYLocation = y / canvasElement.height * 90;
                document.getElementById("timer").style.top = timerYLocation + "%";
                document.getElementById("timer").style.left = timerXLocation + "%";

            }
            else if (i < 11) {
                // change circleDiameter to draw facial landmarks
                canvasCtx.fillStyle = 'lightblue';
                canvasCtx.strokeStyle = 'blue';
                circleDiameter = 0;
            }
            else if (i % 2 == 0) {
                canvasCtx.fillStyle = 'orange';
                canvasCtx.strokeStyle = 'red';
                circleDiameter = 15;
            }
            else {
                canvasCtx.fillStyle = 'lightgreen';
                canvasCtx.strokeStyle = 'green';
                circleDiameter = 15;
            }
            canvasCtx.linewidth = 10;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, circleDiameter, 0, 2 * Math.PI);
            canvasCtx.closePath();
            canvasCtx.fill();
            canvasCtx.stroke();
        }
    }
}

// normalize landmarks from 0-1
function normalizeLandmarks(landmarks) {
    let normalizedLandmarks = [];
    let xMin = 100;
    let xMax = 0;
    let yMin = 100;
    let yMax = 0;
    let zMin = 100;
    let zMax = 0;

    for (let i = 0; i < landmarks.length; i++) {
        if (landmarks[i][0] < xMin) {
            xMin = landmarks[i][0];
        }
        if (landmarks[i][0] > xMax) {
            xMax = landmarks[i][0];
        }
        if (landmarks[i][1] < yMin) {
            yMin = landmarks[i][1];
        }
        if (landmarks[i][1] > yMax) {
            yMax = landmarks[i][1];
        }
        if (landmarks[i][2] < zMin) {
            zMin = landmarks[i][2];
        }
        if (landmarks[i][2] > zMax) {
            zMax = landmarks[i][2];
        }
    }
    for (let i = 0; i < landmarks.length; i++) {
        normalizedLandmarks.push([(landmarks[i][0] - xMin) / (xMax - xMin), (landmarks[i][1] - yMin) / (yMax - yMin), (landmarks[i][2] - zMin) / (zMax - zMin)]);
    }

    return normalizedLandmarks;
}


// draw the target yoga pose on the canvas
function drawTargetPoseLandmarkLines() {
    let currentPoseNumber = thisWorkoutSchedule[currentPoseInThisWorkout - 1];
    let landmarks = allYogaPoseInfo[currentPoseNumber].Landmarks;
    // normalize the landmarks so Y axis is just above bottom of canvas 
    let blankBottomAmount = 0.95; // set amount of blank space below the landmarks
    let currentYmax = 0;
    for (let i = 0; i < landmarks.length; i++) {
        if (landmarks[i][1] > currentYmax) {
            currentYmax = landmarks[i][1];
        }
    }
    let newTopAmount = (25 + parseInt(75 * (blankBottomAmount - currentYmax)))
    document.getElementsByClassName("target_pose_canvas")[0].style.top = newTopAmount + "%";
    document.getElementsByClassName("target_pose_canvas")[0].style.height = "75%";

    targetPoseCanvasCtx.clearRect(0, 0, targetPoseCanvasElement.width, targetPoseCanvasElement.height);
    // draw large circle for head
    headX = Math.round(landmarks[0][0] * targetPoseCanvasElement.width);
    headY = Math.round(landmarks[0][1] * targetPoseCanvasElement.height);
    targetPoseCanvasCtx.fillStyle = 'lightgreen';
    targetPoseCanvasCtx.strokeStyle = 'green';
    circleDiameter = 40;
    targetPoseCanvasCtx.linewidth = 10;
    targetPoseCanvasCtx.beginPath();
    targetPoseCanvasCtx.arc(headX, headY, circleDiameter, 0, 2 * Math.PI);
    targetPoseCanvasCtx.closePath();
    targetPoseCanvasCtx.fill();
    targetPoseCanvasCtx.stroke();

    let connections = [[11, 13], [13, 15], [15, 19], [12, 14], [14, 16], [16, 20], [12, 11], [12, 24], [11, 23], [23, 24], [23, 25], [24, 26], [26, 28], [25, 27], [27, 31], [28, 32]];
    connections.forEach(function (item, index) {
        let xStart = Math.round(landmarks[item[0]][0] * canvasElement.width);
        let yStart = Math.round(landmarks[item[0]][1] * canvasElement.height);
        let yFinish = Math.round(landmarks[item[1]][1] * canvasElement.height);
        let xFinish = Math.round(landmarks[item[1]][0] * canvasElement.width);
        targetPoseCanvasCtx.beginPath();
        targetPoseCanvasCtx.moveTo(xStart, yStart);
        if (item[0] == 12 && item[1] == 11 || item[0] == 23 && item[1] == 24) {
            targetPoseCanvasCtx.strokeStyle = 'lightblue';
        }
        else if (item[0] % 2 == 0) {
            targetPoseCanvasCtx.strokeStyle = 'orange';
        }
        else {
            targetPoseCanvasCtx.strokeStyle = 'lightgreen';
        }
        targetPoseCanvasCtx.lineWidth = 10;
        targetPoseCanvasCtx.lineCap = 'round';
        targetPoseCanvasCtx.lineTo(xFinish, yFinish);
        targetPoseCanvasCtx.stroke();

        targetPoseCanvasCtx.beginPath();
        targetPoseCanvasCtx.moveTo(xStart, yStart);
        if (item[0] == 12 && item[1] == 11 || item[0] == 23 && item[1] == 24) {
            targetPoseCanvasCtx.strokeStyle = 'blue';
        }
        else if (item[0] % 2 == 0) {
            targetPoseCanvasCtx.strokeStyle = 'red';
        }
        else {
            targetPoseCanvasCtx.strokeStyle = 'green'
        }
        targetPoseCanvasCtx.lineWidth = 2;
        targetPoseCanvasCtx.lineCap = 'round';
        targetPoseCanvasCtx.lineTo(xFinish, yFinish);
        targetPoseCanvasCtx.stroke();
    });
}

// draw the normalized user landmark lines and circles to the canvas so all of the landmarks are displayed



// draw selection circles next to ears
function drawSelectionCircles(landmarks) {
    updateInstructions("Put hands in circles to begin");
    let circleDiameter = 50; // put at start of function so can compare distances
    let leftX = parseInt((landmarks[11].x) * canvasElement.width); //left shoulder
    let leftY = parseInt((landmarks[7].y) * canvasElement.height); //left eye
    let rightX = parseInt((landmarks[12].x) * canvasElement.width); //right shoulder
    let rightY = parseInt((landmarks[8].y) * canvasElement.height); //right eye
    let leftHandX = parseInt((landmarks[19].x) * canvasElement.width); //left hand
    let leftHandY = parseInt((landmarks[19].y) * canvasElement.height); //left hand
    let rightHandX = parseInt((landmarks[20].x) * canvasElement.width); //right hand
    let rightHandY = parseInt((landmarks[20].y) * canvasElement.height); //right hand
    // calculate the distance between two points
    let leftDistance = Math.sqrt(Math.pow(leftX - leftHandX, 2) + Math.pow(leftY - leftHandY, 2));
    let rightDistance = Math.sqrt(Math.pow(rightX - rightHandX, 2) + Math.pow(rightY - rightHandY, 2));
    canvasCtx.linewidth = 10;
    if (leftDistance >= circleDiameter) {
        canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        canvasCtx.strokeStyle = 'pink';
        canvasCtx.beginPath();
        canvasCtx.arc(leftX, leftY, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    else {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        canvasCtx.strokeStyle = 'lightgreen';
        canvasCtx.beginPath();
        canvasCtx.arc(leftX, leftY, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    if (rightDistance >= circleDiameter) {
        canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        canvasCtx.strokeStyle = 'pink';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX, rightY, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    else {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        canvasCtx.strokeStyle = 'lightgreen';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX, rightY, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    // action to preform if hands are in selection circles
    if (leftDistance <= circleDiameter && rightDistance <= circleDiameter) {
        menuTracker += 1;
        // thisWorkoutSchedule = setYogaRoutine(6);
        // workoutStarted = true;
        // startWorkout(10); // start workout (timerPerPose)
        document.getElementById("instructions").style.visibility = "hidden";
    }
}

// draw the selection menu
// menu choices are on right side and confirmation is on left side
var workoutSelected = ''; // when menuTracker is 1
var numberOfPoses = 0; // when menuTracker is 2
var timePerPose = 0; // when menuTracker is 3

var canSelectMenu = true;

function drawSelectionMenu(landmarks) {
    // text for instructions
    document.getElementById("menu").innerHTML = "Left hand to confirm and right hand to select options";
    let circleDiameter = 50; // put at start of function so can compare distances
    // where to draw circles
    // confirm selection circle 
    let leftX = parseInt((landmarks[11][0]) * canvasElement.width); //left shoulder
    let leftY = parseInt((landmarks[7][1]) * canvasElement.height); //left eye
    // choice circle 1
    let rightX1 = parseInt((landmarks[12][0]) * canvasElement.width * .85); //right shoulder
    let rightY1 = parseInt((landmarks[12][1]) * canvasElement.height); //right shoulder
    // choice circle 2
    let rightX2 = parseInt((landmarks[12][0]) * canvasElement.width * .8); //right shoulder

    let rightY2 = parseInt((((landmarks[24][1] - landmarks[12][1]) / 2) + landmarks[12][1]) * canvasElement.height); //between shoulder and hip
    // choice circle 3
    let rightX3 = parseInt((landmarks[12][0]) * canvasElement.width * .85); //right shoulder
    let rightY3 = parseInt((landmarks[24][1]) * canvasElement.height); //right hip
    // get the position of the hands
    let leftHandX = parseInt((landmarks[19][0]) * canvasElement.width); //left hand
    let leftHandY = parseInt((landmarks[19][1]) * canvasElement.height); //left hand
    let rightHandX = parseInt((landmarks[20][0]) * canvasElement.width); //right hand
    let rightHandY = parseInt((landmarks[20][1]) * canvasElement.height); //right hand
    // calculate the distance between the position of the hand and the selection circle
    let leftDistance = Math.sqrt(Math.pow(leftX - leftHandX, 2) + Math.pow(leftY - leftHandY, 2));
    let rightDistance1 = Math.sqrt(Math.pow(rightX1 - rightHandX, 2) + Math.pow(rightY1 - rightHandY, 2));
    let rightDistance2 = Math.sqrt(Math.pow(rightX2 - rightHandX, 2) + Math.pow(rightY2 - rightHandY, 2));
    let rightDistance3 = Math.sqrt(Math.pow(rightX3 - rightHandX, 2) + Math.pow(rightY3 - rightHandY, 2));
    canvasCtx.linewidth = 10;
    // draw confrimation circle
    if (leftDistance >= circleDiameter) {
        canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        canvasCtx.strokeStyle = 'pink';
        canvasCtx.beginPath();
        canvasCtx.arc(leftX, leftY, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();

    }
    else {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        canvasCtx.strokeStyle = 'lightgreen';
        canvasCtx.beginPath();
        canvasCtx.arc(leftX, leftY, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }


    circleDiameter = 30;
    // draw choice circle 1
    if (rightDistance1 >= circleDiameter) {
        canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        canvasCtx.strokeStyle = 'pink';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX1, rightY1, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    else {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        canvasCtx.strokeStyle = 'lightgreen';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX1, rightY1, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }

    // draw choice circle 2
    if (rightDistance2 >= circleDiameter) {
        canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        canvasCtx.strokeStyle = 'pink';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX2, rightY2, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();

    }
    else {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        canvasCtx.strokeStyle = 'lightgreen';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX2, rightY2, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    // draw choice circle 3
    if (rightDistance3 >= circleDiameter) {
        canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        canvasCtx.strokeStyle = 'pink';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX3, rightY3, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();

    }
    else {
        canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        canvasCtx.strokeStyle = 'lightgreen';
        canvasCtx.beginPath();
        canvasCtx.arc(rightX3, rightY3, circleDiameter, 0, 2 * Math.PI);
        canvasCtx.closePath();
        canvasCtx.fill();
        canvasCtx.stroke();
    }
    nonReversedCanvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // clear canvas

    // draw "Confirm" text
    confirmX = (canvasElement.width - leftX - 90);
    confirmY = (leftY - 60);
    confirmText = "Confirm";
    nonReversedCanvasCtx.font = '60px Sans-serif';
    nonReversedCanvasCtx.strokeStyle = 'black';
    nonReversedCanvasCtx.lineWidth = 4;
    nonReversedCanvasCtx.strokeText(confirmText, confirmX, confirmY);
    nonReversedCanvasCtx.fillStyle = 'lightgreen';
    nonReversedCanvasCtx.fillText(confirmText, confirmX, confirmY);

    // set the text for menu choices
    let options = []
    let title = "Select your choice"
    if (menuTracker == 1) {
        options = ['Off the ground', 'On the ground', 'Morning stretch']
        title = "Select your workout type"
    }
    else if (menuTracker == 2) {
        options = [5, 10, 15]
        title = "How many total poses?"
    }
    else if (menuTracker == 3) {
        options = [10, 20, 30]
        title = "Seconds per pose?"
    }
    positions = [[rightX1, rightY1], [rightX2, rightY2], [rightX3, rightY3]];
    i = 0
    while (i < 3) {
        // draw title
        rightXInverse = (canvasElement.width - positions[0][0]) - 50;
        adjustY = positions[0][1] - 60;
        nonReversedCanvasCtx.font = '60px Sans-serif';
        nonReversedCanvasCtx.strokeStyle = 'black';
        nonReversedCanvasCtx.lineWidth = 4;
        nonReversedCanvasCtx.strokeText(title, rightXInverse, adjustY);
        nonReversedCanvasCtx.fillStyle = 'lightgreen';
        nonReversedCanvasCtx.fillText(title, rightXInverse, adjustY);
        // draw menu choices
        rightXInverse = (canvasElement.width - positions[i][0]) + 40;
        adjustY = positions[i][1] + 20;
        nonReversedCanvasCtx.font = '50px Sans-serif';
        nonReversedCanvasCtx.strokeStyle = 'black';
        nonReversedCanvasCtx.lineWidth = 4;
        nonReversedCanvasCtx.strokeText(options[i], rightXInverse, adjustY);
        nonReversedCanvasCtx.fillStyle = 'lightgreen';
        nonReversedCanvasCtx.fillText(options[i], rightXInverse, adjustY);
        i++;
    }

    // action to preform if hands are in selection circles
    if (canSelectMenu) {
        if (leftDistance <= circleDiameter && rightDistance1 <= circleDiameter) {
            // return choice one
            console.log("choice one");
            setOptions(options[0]);
            canSelectMenu = false;
        }
        else if (leftDistance <= circleDiameter && rightDistance2 <= circleDiameter) {
            // return choice two
            console.log("choice two");
            setOptions(options[1]);
            canSelectMenu = false;

        }
        else if (leftDistance <= circleDiameter && rightDistance3 <= circleDiameter) {
            // return choice three
            console.log("choice three");
            setOptions(options[2]);
            canSelectMenu = false;

        }
    }
    // allow to select menu again after hands are out of selection circles
    if (leftDistance > circleDiameter && rightDistance1 > circleDiameter && rightDistance2 > circleDiameter && rightDistance3 > circleDiameter) {
        canSelectMenu = true;
    }
    // set given options depending on the menu tracker state
    function setOptions(options) {
        if (menuTracker == 1) {
            if (options == 'Off the ground') {
                workoutSelected = 1;
            }
            else if (options == 'On the ground') {
                workoutSelected = 2;
            }
            else if (options == 'Morning stretch') {
                workoutSelected = 3;
            }
        }
        else if (menuTracker == 2) {
            if (options == 5) {
                numberOfPoses = 5;
            }
            else if (options == 10) {
                numberOfPoses = 10;
            }
            else if (options == 15) {
                numberOfPoses = 15;
            }
        }
        else if (menuTracker == 3) {
            if (options == 10) {
                timePerPose = 10;
            }
            else if (options == 20) {
                timePerPose = 20;
            }
            else if (options == 30) {
                timePerPose = 30;
            }
        }
        menuTracker++;
        // exit menu selectoin after completion of all menu choices
        if (menuTracker > 3) {
            thisWorkoutSchedule = setYogaRoutine(workoutSelected, numberOfPoses);
            startWorkout(timePerPose); // start workout (timerPerPose)
            workoutStarted = true;
            // clear this canvas and hide instructions
            nonReversedCanvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // clear canvas
            document.getElementById("instructions").style.visibility = "hidden";
            document.getElementById("menu").style.visibility = "hidden";
        }
    }
}

// take in the ID of the pose to draw on , pose ID number
function drawYogaImageOnCanvas(poseCanvasID, poseNumber) {
    var lastPoseCanvas = document.getElementById(poseCanvasID);
    var lastPoseCtx = lastPoseCanvas.getContext('2d');
    // console.log("Yoga pose relative location: ",allYogaPoseInfo[2].RelativeLocation)
    let img = new Image();
    img.onload = function () {
        lastPoseCtx.drawImage(img, 0, 0, lastPoseCanvas.width, lastPoseCanvas.height); // Or at whatever offset you like
    };
    img.src = allYogaPoseInfo[poseNumber].RelativeLocation;
}
// update the pose canvases and pose counter
function updateYogaPoseCanvases() {
    document.getElementById("poseCount").innerHTML = "Pose: " + currentPoseInThisWorkout + " of " + totalPosesInThisWorkout; //update pose count
    if (currentPoseInThisWorkout < totalPosesInThisWorkout - 1) {
        drawYogaImageOnCanvas("poseCanvas1", thisWorkoutSchedule[currentPoseInThisWorkout - 1]);
        drawYogaImageOnCanvas("poseCanvas2", thisWorkoutSchedule[currentPoseInThisWorkout]);
        drawYogaImageOnCanvas("poseCanvas3", thisWorkoutSchedule[currentPoseInThisWorkout + 1]);
    }
    else if (currentPoseInThisWorkout < totalPosesInThisWorkout) {
        drawYogaImageOnCanvas("poseCanvas1", thisWorkoutSchedule[currentPoseInThisWorkout - 1]);
        drawYogaImageOnCanvas("poseCanvas2", thisWorkoutSchedule[currentPoseInThisWorkout]);
        document.getElementById("poseCanvas3").style.visibility = "hidden";
    }
    else {
        drawYogaImageOnCanvas("poseCanvas1", thisWorkoutSchedule[currentPoseInThisWorkout - 1]);
        document.getElementById("poseCanvas2").style.visibility = "hidden";
        document.getElementById("poseCanvas3").style.visibility = "hidden";
    }
}
// actions to perform once the workout is started
function startWorkout(timePerPose) {
    document.getElementById("poseCanvas1").style.visibility = "visible";
    document.getElementById("poseCanvas2").style.visibility = "visible";
    document.getElementById("poseCanvas3").style.visibility = "visible";
    document.getElementById("poseCount").style.visibility = "visible";
    document.getElementById("score").style.visibility = "visible";
    document.getElementById("timer").style.visibility = "visible";
    document.getElementById("bestPose").style.visibility = "visible";
    createTimer(timePerPose);
}
// update the highscore image and number
function updateHighScoreData(currentScore) {
    // save the camera image to a file
    if (currentScore >= thisPoseHighScore) {
        thisPoseHighScore = currentScore;
        let text = "High score: " + currentScore;
        document.getElementById("highscore").innerHTML = text
        bestPoseCanvasCtx.drawImage(currentInputImage, 0, 0, 320, 180);
    }

}

// update the position and number for score on the score DOM element
// take in the current score and landmarks array
function updateScore(score) {
    nonReversedCanvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // clear canvas for score arc
    higherBetterScore = 1500 - score;
    score = parseInt((higherBetterScore / 1500) * 100); //normailze score to a percentage
    currentScore = score;
    document.getElementById('score').innerHTML = score + "%";

    // update the highscore image and number
    updateHighScoreData(score);

    // use below code to draw an arc on the nonreversed canvas
    let startPosition = (1 * Math.PI);
    let endPosition = (startPosition + ((score / 100) * (Math.PI)));
    // console.log("start position: " + startPosition + " end position: " + endPosition);
    // fixed position
    // let xPosition = (canvasElement.width / 2) + 30;
    // let yPosition = canvasElement.height * 0.15;
    // moving position
    let xPosition = parseInt((1 - currentLandmarksArray[0][0]) * canvasElement.width);
    let yPosition = parseInt(currentLandmarksArray[0][1] * canvasElement.height - 50);

    // nonReversedCanvasCtx.beginPath();
    // nonReversedCanvasCtx.arc(xPosition, yPosition, 100, startPosition, endPosition);
    // nonReversedCanvasCtx.lineWidth = 15;
    // nonReversedCanvasCtx.strokeStyle = "lightgreen";
    // nonReversedCanvasCtx.stroke();

    // use below code to draw the score to above the users head
    // scoreBoard.style.top = (landmarks[0][1] * 40) + '%';
    // scoreBoard.style.left = ((1 - landmarks[0][0]) * 85) + '%';


}

function updateInstructions(instruction) {
    document.getElementById('instructions').innerHTML = instruction;
    document.getElementById('instructions').style.top = (currentLandmarksArray[0][1] * 20) + '%';
    document.getElementById('instructions').style.left = ((1 - currentLandmarksArray[0][0]) * 35) + '%';
}

/// ---- This section calculates the angles of joints ---- ////
function CalculateAngle(coord1, coord2, coord3) {
    const v1 = {
        x: coord1.x - coord2.x,
        y: coord1.y - coord2.y,
        z: coord1.z - coord2.z,
    };
    const v2 = {
        x: coord3.x - coord2.x,
        y: coord3.y - coord2.y,
        z: coord3.z - coord2.z,
    };
    // Normalize v1
    const v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const v1norm = {
        x: v1.x / v1mag,
        y: v1.y / v1mag,
        z: v1.z / v1mag,
    };
    // Normalize v2
    const v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    const v2norm = {
        x: v2.x / v2mag,
        y: v2.y / v2mag,
        z: v2.z / v2mag,
    };
    // Calculate the dot products of vectors v1 and v2
    const dotProducts = v1norm.x * v2norm.x + v1norm.y * v2norm.y + v1norm.z * v2norm.z;
    // Extract the angle from the dot products
    const angle = (Math.acos(dotProducts) * 180.0) / Math.PI;
    // Round result to 3 decimal points and return
    return Math.round(angle);
};

// calculate angle of joints
// middle landmark is the fixed point
function CalculateAllAngles(landmarks) {
    let allAngles = [];
    let leftShoulderAngle = CalculateAngle(landmarks[13], landmarks[11], landmarks[23]);
    let rightShoulderAngle = CalculateAngle(landmarks[14], landmarks[12], landmarks[24]);

    let leftElbowAngle = CalculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    let rightElbowAngle = CalculateAngle(landmarks[12], landmarks[14], landmarks[16]);

    let leftArmAngleToGroundMiddlePoint = { "x": landmarks[11].x, "y": 10, "z": landmarks[11].z };
    let leftArmAngleToGround = CalculateAngle(leftArmAngleToGroundMiddlePoint, landmarks[11], landmarks[13]);
    let rightArmAngleToGroundMiddlePoint = { "x": landmarks[12].x, "y": 10, "z": landmarks[12].z };
    let rightArmAngleToGround = CalculateAngle(rightArmAngleToGroundMiddlePoint, landmarks[12], landmarks[14]);

    let leftHipAngle = CalculateAngle(landmarks[11], landmarks[23], landmarks[25]);
    let rightHipAngle = CalculateAngle(landmarks[12], landmarks[24], landmarks[26]);

    let leftKneeAngle = CalculateAngle(landmarks[23], landmarks[25], landmarks[27]);
    let rightKneeAngle = CalculateAngle(landmarks[24], landmarks[26], landmarks[28]);

    let leftLegAngleToGroundMiddlePoint = { "x": landmarks[23].x, "y": 10, "z": landmarks[23].z };
    let leftLegAngleToGround = CalculateAngle(leftLegAngleToGroundMiddlePoint, landmarks[23], landmarks[25]);
    let rightLegAngleToGroundMiddlePoint = { "x": landmarks[24].x, "y": 10, "z": landmarks[24].z };
    let rightLegAngleToGround = CalculateAngle(rightLegAngleToGroundMiddlePoint, landmarks[24], landmarks[26]);

    let leftFootAngle = CalculateAngle(landmarks[25], landmarks[27], landmarks[31]);
    let rightFootAngle = CalculateAngle(landmarks[26], landmarks[28], landmarks[32]);
    allAngles = [leftShoulderAngle, rightShoulderAngle, leftElbowAngle, rightElbowAngle, leftArmAngleToGround, rightArmAngleToGround, leftHipAngle, rightHipAngle, leftKneeAngle, rightKneeAngle, leftLegAngleToGround, rightLegAngleToGround, leftFootAngle, rightFootAngle];
    return allAngles;
}

// take in the two angle arrays and find the differnence between them. poseHandicap is the amount of slack to give , eg. 10 allows 10 degrees of slack
function CalculateAngleDifferences(userAngles, targetAngles, poseHandicap) {
    let totalAngleDifference = 0;
    for (let i = 0; i < userAngles.length; i++) {
        let P1thisPoseAnglesNew = userAngles[i];
        let P2thisPoseAnglesNew = targetAngles[i];
        let thisAngleDifference = Math.abs(P1thisPoseAnglesNew - P2thisPoseAnglesNew) - poseHandicap;
        totalAngleDifference += thisAngleDifference;
    }
    return totalAngleDifference;
}

// create a timer for time amount of seconds
function createTimer(time) {
    let startTime = time;
    let timer = setInterval(function () {
        document.getElementById("timer").innerHTML = time;
        time--;
        if (time <= 0) {
            if (currentPoseInThisWorkout == totalPosesInThisWorkout) {
                clearInterval(timer);
                console.log("workout complete");
                console.log("all workout data", allWorkoutData);
                postWorkoutData(allWorkoutData);
            }
            else {
                time = startTime;
                currentPoseInThisWorkout++; // increment to next pose
                updateYogaPoseCanvases();
                thisPoseHighScore = 0; // reset pose high score for tracking high score image
            }
            return;
        }
        document.getElementById('timer').innerHTML = time;
    }, 1000);
}

// data to save to JSON file
var allWorkoutData = [{}];

function dataToSave() {
    let currentTime = new Date();
    let time = currentTime.getTime();
    let currentPoseNumber = thisWorkoutSchedule[currentPoseInThisWorkout - 1];
    let currentLandmarks = currentLandmarksArray;
    let workout = {
        "date": time,
        "pose": currentPoseNumber,
        "score": currentScore,
        "landmarks": currentLandmarks
    };
    allWorkoutData.push(workout);
}

/// this fuction will call when workout is complete
function postWorkoutData(data){
    console.log("workout complete and data is posting")
    return;
}

