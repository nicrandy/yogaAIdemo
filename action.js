const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const timer = document.getElementById("timer");
const scoreBoard = document.getElementById("score");

// ---------  START global variables ---------- //
var allYogaPoseInfo = []; // load from json file of pose info
var currentLandmarksArray = []; // live update of output landmarks
var thisWorkoutSchedule = []; // array of poses related to images in example_poses
var totalPosesInThisWorkout = 0; // set the total number of poses to do for this workout
var currentPoseInThisWorkout = 1; // start with pose 1
var workoutStarted = false; // draw selection circles if workout not started yet


// ---------  END global variables ---------- //

// from json file, includes image file location, name and pose angles
function loadJSON(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'poseInfo.json', true);
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
    if (!results.poseLandmarks) {
        return;
    }
    // ------ all of the actions to perform when there are results
    currentLandmarksArray = convertLandmarkObjectToArray(results.poseLandmarks);
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // clear canvas
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height); // draw camera input image

    drawLandmarkLines(currentLandmarksArray); // draw landmarks on canvas
    drawLandmarkCircles(currentLandmarksArray); // draw circles on landmarks on canvas
    // actions to prerform before starting workout
    if (!workoutStarted) {
        drawSelectionCircles(results.poseLandmarks); // draw selection circles until workout starts
    }
    // actions to perform during workout
    if (workoutStarted) {
        updateYogaPoseCanvases(); // update the yoga pose canvases
        let userAngles = CalculateAllAngles(results.poseLandmarks); // calculate angles for current user pose
        let targetAngles = allYogaPoseInfo[3].Angles; // calculate angles for current target pose
        let angleDifferenceScore = CalculateAngleDifferences(userAngles, targetAngles, 10); // calculate angle differences
        updateScore(angleDifferenceScore, currentLandmarksArray); // update score on score DOM element
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
// input the number of poses to do for that workout
function setYogaRoutine(poseTotal) {
    totalPosesInThisWorkout = poseTotal;
    let onlyStandingRotine = [8, 18, 21, 22, 31, 36, 39, 60, 68, 74, 75, 76]
    let easyOnTheGround = [1, 3, 7, 9, 10, 12, 15, 16, 17, 20, 29, 30, 33, 34, 37, 38, 44, 48, 52, 56, 57, 59, 65, 67, 71, 73, 80]
    let easyStretch = [3, 5, 9, 10, 17, 21, 29, 34, 40, 45, 48, 49, 52, 72, 76]
    // select amount from each array
    let selectedArray = onlyStandingRotine
    let amount = poseTotal
    let thisWorkout = selectedArray.sort(() => Math.random() - 0.5).slice(0, amount);
    console.log("this workout schedule: ", thisWorkout)
    return thisWorkout;
}

// draw circles on landmarks. Input is landmarks array [x,y,z,visibility]
function drawLandmarkCircles(landmarks) {
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        const x = landmark[0] * canvasElement.width;
        const y = landmark[1] * canvasElement.height;
        let circleDiameter = 10;
        if (i < 11) {
            canvasCtx.fillStyle = 'lightblue';
            canvasCtx.strokeStyle = 'blue';
            circleDiameter = 10;
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
// draw lines between landmarks
function drawLandmarkLines(landmarks) {
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
}


// draw selection circles next to ears
function drawSelectionCircles(landmarks) {
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
        thisWorkoutSchedule = setYogaRoutine(6);
        workoutStarted = true;
        startWorkout(10); // start workout (timerPerPose)
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
    document.getElementById("poseCount").innerHTML = "Pose: " + currentPoseInThisWorkout + " of "+ totalPosesInThisWorkout; //update pose count
    if (currentPoseInThisWorkout < totalPosesInThisWorkout - 1) {
    drawYogaImageOnCanvas("poseCanvas1", thisWorkoutSchedule[currentPoseInThisWorkout - 1]);
    drawYogaImageOnCanvas("poseCanvas2", thisWorkoutSchedule[currentPoseInThisWorkout ]);
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
    createTimer(timePerPose);
}


// update the position and number for score on the score DOM element
// take in the current score and landmarks array
function updateScore(score, landmarks) {
    score = parseInt((score / 2520) * 100); //normailze score to a percentage
    document.getElementById('score').innerHTML = score + "%";
    // use below code to draw the score to above the users head
    // scoreBoard.style.top = (landmarks[0][1] * 40) + '%';
    // scoreBoard.style.left = ((1 - landmarks[0][0]) * 85) + '%';
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
        console.log("time",time);
        document.getElementById("timer").innerHTML = time;
        time--;
        if (time <= 0) {
            if (currentPoseInThisWorkout == totalPosesInThisWorkout) {
                clearInterval(timer);
                console.log("workout complete");
            }
            else {
                time = startTime;
                currentPoseInThisWorkout++; // increment to next pose
                updateYogaPoseCanvases();
            }
            return;
        }
        document.getElementById('timer').innerHTML = time;
    }, 1000);
}
