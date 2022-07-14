import math
import cv2
import mediapipe as mp
import numpy as np
import json
import os
import csv
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_pose = mp.solutions.pose

# // x = [0] y = [1] z = [2]


def CalculateAngle(coord1, coord2, coord3):
    v1 = {
        "x": coord1[0] - coord2[0],
        "y": coord1[1] - coord2[1],
        "z": coord1[2] - coord2[2],
    }
    v2 = {
        "x": coord3[0] - coord2[0],
        "y": coord3[1] - coord2[1],
        "z": coord3[2] - coord2[2],
    }
    v1mag = math.sqrt(v1["x"] * v1["x"] + v1["y"]
                      * v1["y"] + v1["z"] * v1["z"])
    v1norm = {
        "x": v1["x"] / v1mag,
        "y": v1["y"] / v1mag,
        "z": v1["z"] / v1mag,
    }
    v2mag = math.sqrt(v2["x"] * v2["x"] + v2["y"]
                      * v2["y"] + v2["z"] * v2["z"])
    v2norm = {
        "x": v2["x"] / v2mag,
        "y": v2["y"] / v2mag,
        "z": v2["z"] / v2mag,
    }
    dotProducts = v1norm["x"] * v2norm["x"] + \
        v1norm["y"] * v2norm["y"] + v1norm["z"] * v2norm["z"]
    angle = (math.acos(dotProducts) * 180.0) / math.pi
    return round(angle * 1000) / 1000


def roundToNearestFive(inputNumber):
    return round(inputNumber) 


allAngles = []
# // x = [0] y = [1] z = [2]


def CalculateAllAngles(landmarks):
    rightShoulderAngle = roundToNearestFive(
        CalculateAngle(landmarks[14], landmarks[12], landmarks[24]))
    leftShoulderAngle = roundToNearestFive(
        CalculateAngle(landmarks[13], landmarks[11], landmarks[23]))

    leftElbowAngle = roundToNearestFive(CalculateAngle(
        landmarks[11], landmarks[13], landmarks[15]))
    rightElbowAngle = roundToNearestFive(CalculateAngle(
        landmarks[12], landmarks[14], landmarks[16]))

    leftArmAngleToGroundMiddlePoint = [
        landmarks[11][0], landmarks[10][1], landmarks[11][2]]
    leftArmAngleToGround = roundToNearestFive(CalculateAngle(
        leftArmAngleToGroundMiddlePoint, landmarks[11], landmarks[13]))
    rightArmAngleToGroundMiddlePoint = [
        landmarks[12][0], landmarks[10][1], landmarks[12][2]]
    rightArmAngleToGround = roundToNearestFive(CalculateAngle(
        rightArmAngleToGroundMiddlePoint, landmarks[12], landmarks[14]))

    leftHipAngle = roundToNearestFive(CalculateAngle(
        landmarks[11], landmarks[23], landmarks[25]))
    rightHipAngle = roundToNearestFive(CalculateAngle(
        landmarks[12], landmarks[24], landmarks[26]))

    leftKneeAngle = roundToNearestFive(CalculateAngle(
        landmarks[23], landmarks[25], landmarks[27]))
    rightKneeAngle = roundToNearestFive(CalculateAngle(
        landmarks[24], landmarks[26], landmarks[28]))

    leftLegAngleToGroundMiddlePoint = [
        landmarks[23][0], landmarks[10][1], landmarks[23][2]]
    leftLegAngleToGround = roundToNearestFive(CalculateAngle(
        leftLegAngleToGroundMiddlePoint, landmarks[23], landmarks[25]))
    rightLegAngleToGroundMiddlePoint = [
        landmarks[24][0], landmarks[10][1], landmarks[24][2]]
    rightLegAngleToGround = roundToNearestFive(CalculateAngle(
        rightLegAngleToGroundMiddlePoint, landmarks[24], landmarks[26]))

    leftFootAngle = roundToNearestFive(CalculateAngle(
        landmarks[25], landmarks[27], landmarks[31]))
    rightFootAngle = roundToNearestFive(CalculateAngle(
        landmarks[26], landmarks[28], landmarks[32]))
    allAngles = [leftShoulderAngle, rightShoulderAngle, leftElbowAngle, rightElbowAngle, leftArmAngleToGround, rightArmAngleToGround,
                 leftHipAngle, rightHipAngle, leftKneeAngle, rightKneeAngle, leftLegAngleToGround, rightLegAngleToGround, leftFootAngle, rightFootAngle]
    return allAngles


def getLinksToImagePoses():
    # For static images:
    imageFolder = 'D:\Yoga project\example_poses'
    imageLinks = []
    i = 0
    while i < 82:
        thisLink = imageFolder + "/" + str(i) + ".jpg"
        imageLinks.append(thisLink)
        i += 1
    # print("Image links", imageLinks)
    return imageLinks


def relativeImageLinks():
    # For static images:
    imageFolder = 'D:\Yoga project\example_poses'
    imageLinks = []
    i = 0
    while i < 82:
        thisLink = "/example_poses/" + str(i) + ".jpg"
        imageLinks.append(thisLink)
        i += 1
    # print("Image links", imageLinks)
    return imageLinks


def getLinksForALLimages():  # For all images in the Yoga82 folder
    namesFolder = 'D:/allYogaImages'
    names = []
    for name in os.listdir(namesFolder):
        # print(name)
        names.append(name)
    # print("Pose name",names)
    return names


def getImageAngles(imageLocation):
    allPoseAngles = []
    allWorldLandmarks = []
    allPoseLandmarks = []
    image_files = imageLocation
    with mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=False,
            min_detection_confidence=0.01) as pose:
        for image_file in image_files:
            if image_file is not None:
                path = image_file
                image = cv2.imread(path)
                if image is not None:
                    results = pose.process(
                        cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                    allWorldLandmarks.append(results.pose_world_landmarks)
                    allPoseLandmarks.append(results.pose_landmarks)
                    # print("Pose landmarks", results.pose_landmarks, "Pose world landmarks", results.pose_world_landmarks)
                    i = 0
                    landmarkArray = []
                    while i < 33:
                        landmarkArray.append([results.pose_world_landmarks.landmark[i].x,
                                             results.pose_world_landmarks.landmark[i].y, results.pose_world_landmarks.landmark[i].z])
                        i += 1
                    allPoseAngles.append(CalculateAllAngles(landmarkArray))

                else:
                    print("Image is None", path)
    # print("All pose landmarks: ", allPoseLandmarks)
    return [allPoseAngles, allWorldLandmarks, allPoseLandmarks]


class Object:
    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__,
                          sort_keys=True, indent=4)


def getAllPoseInfo():
    names = getLinksForALLimages()
    imageLinks = getLinksToImagePoses()
    landmarkInformation = getImageAngles(imageLinks)
    relativeLinks = relativeImageLinks()
    allPoseAngles = landmarkInformation[0]
    # worldlandmarks = Object()
    # worldlandmarks.landmarks = landmarkInformation[1]
    # landmarks = landmarkInformation[2]

    landmarkArray = []
    i = 0
    while i < 33:
        landmarkArray.append([[landmarks.landmark[i].x], [landmarks.landmark[i].y], [
                             landmarks.landmark[i].z], [landmarks.landmark[i].visibility]])
        i += 1

    k = 0
    landmarkArray = []
    while k < 33:
        landmarkArray.append([results.pose_world_landmarks.landmark[i].x,
                                results.pose_world_landmarks.landmark[i].y, results.pose_world_landmarks.landmark[i].z])
        k += 1
    allPoseAngles.append(CalculateAllAngles(landmarkArray))




    j = 0
    poseInfo = []
    while j < len(names):
        # print(type(worldlandmarks[j]))
        thisPoseInformation = {"RelativeLocation": relativeLinks[j], "Location": imageLinks[j], "Name": names[j], "Angles": allPoseAngles[j],
                               "PoseLandmarks": landmarkArray}
        print(thisPoseInformation)
        # allPoseInfo = json.dumps(thisPoseInformation)
        # print("This pose information", thisPoseInformation)
        poseInfo.append(thisPoseInformation)
        # y = json.loads
        j += 1
        # print(allPoseInfo)
    return poseInfo


def writeToCSV(poseInfo):
    with open('poseInfo.csv', 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(poseInfo)


def writeAllPoseInfoToJSON():
    allPoseInfo = getAllPoseInfo()
    with open('poseInfo.json', 'w') as f:
        json.dump(allPoseInfo, f)
    # print("JSON Object", allPoseInfo)

# writeAllPoseInfoToJSON()


def getImageLandmarks():
    names = getLinksForALLimages()
    imageLinks = getLinksToImagePoses()
    relativeLocation = relativeImageLinks()
    jsonData = []
    i = 0
    while i < 82:
        with mp_pose.Pose(
                static_image_mode=True,
                model_complexity=2,
                enable_segmentation=False,
                min_detection_confidence=0.01) as pose:
            path = imageLinks[i]
            image = cv2.imread(path)
            results = pose.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
            imageLandmarks = results.pose_landmarks

            landmarkArray = []
            j = 0
            while j < 33:
                landmarkArray.append([[imageLandmarks.landmark[j].x], [imageLandmarks.landmark[j].y], [imageLandmarks.landmark[j].z], [imageLandmarks.landmark[j].visibility]])
                j += 1

            k = 0
            anglesArray = []
            while k < 33:
                anglesArray.append([results.pose_world_landmarks.landmark[k].x,
                                        results.pose_world_landmarks.landmark[k].y, results.pose_world_landmarks.landmark[k].z])
                k += 1
            theseAngles = CalculateAllAngles(anglesArray)


            thisPoseInfo = {"PoseNumber": i, "Name": names[i],"RelativeLocation": relativeLocation[i], "Location": imageLinks[i], "Angles": theseAngles, "Landmarks": landmarkArray}
            jsonData.append(thisPoseInfo)
            print(thisPoseInfo)
            i += 1
            with open('poseInfo2.json', 'w') as f:
                json.dump(jsonData, f)


getImageLandmarks()
