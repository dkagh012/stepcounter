import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  StatusBar,
  Dimensions,
} from "react-native";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";

const { width, height } = Dimensions.get("window");

export default function App() {
  const [stepCount, setStepCount] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [accelerometerData, setAccelerometerData] = useState({
    x: 0,
    y: 0,
    z: 0,
  });
  const [debugInfo, setDebugInfo] = useState("초기화 중...");
  const [isTracking, setIsTracking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userGender, setUserGender] = useState("");
  const [userAge, setUserAge] = useState("");
  const [userStride, setUserStride] = useState("");
  const [savedRecords, setSavedRecords] = useState([]);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const isTrackingRef = useRef(false);
  const currentStepCount = useRef(0);
  const accelerometerSubscription = useRef(null);
  const lastStepTime = useRef(Date.now());
  const lastAcceleration = useRef(0);
  const isPeak = useRef(false);
  const startTime = useRef(null);
  const timeInterval = useRef(null);

  const stepThreshold = 1.2;
  const stepInterval = 300;

  // 시간 업데이트
  useEffect(() => {
    if (isTracking) {
      timeInterval.current = setInterval(() => {
        if (startTime.current) {
          const elapsed = Date.now() - startTime.current;
          const minutes = Math.floor(elapsed / 60000);
          const seconds = Math.floor((elapsed % 60000) / 1000);
          setCurrentTime(
            `${minutes.toString().padStart(2, "0")}:${seconds
              .toString()
              .padStart(2, "0")}`
          );
        }
      }, 1000);
    } else {
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }
    }

    return () => {
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }
    };
  }, [isTracking]);

  useEffect(() => {
    const init = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDebugInfo("❌ 위치 권한이 없습니다.");
        return;
      }
      setDebugInfo("✅ 위치 권한 허용됨. 설정 후 '시작'을 누르세요.");
    };
    init();
    return () => {
      stopTracking();
    };
  }, []);

  const startTracking = () => {
    if (!userGender || !userAge || !userStride) {
      Alert.alert("설정 필요", "성별, 나이, 보폭을 모두 설정해주세요.");
      return;
    }

    isTrackingRef.current = true;
    setIsTracking(true);
    startTime.current = Date.now();
    setDebugInfo("▶ 측정 시작됨");

    Accelerometer.setUpdateInterval(100);
    accelerometerSubscription.current = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const acceleration = Math.sqrt(x * x + y * y + z * z);

      const now = Date.now();

      if (
        acceleration > stepThreshold &&
        acceleration > lastAcceleration.current &&
        !isPeak.current &&
        now - lastStepTime.current > stepInterval
      ) {
        isPeak.current = true;
        handleStep(x, y, z, now - lastStepTime.current);
        lastStepTime.current = now;
      }

      if (acceleration < stepThreshold && isPeak.current) {
        isPeak.current = false;
      }

      lastAcceleration.current = acceleration;
      setAccelerometerData({ x, y, z });
    });
  };

  const stopTracking = () => {
    isTrackingRef.current = false;
    setIsTracking(false);
    setDebugInfo("⏹ 측정 정지됨");

    if (accelerometerSubscription.current) {
      accelerometerSubscription.current.remove();
      accelerometerSubscription.current = null;
    }
  };

  const handleStep = (x, y, z, timeDiff) => {
    if (!isTrackingRef.current) return;

    currentStepCount.current += 1;
    setStepCount(currentStepCount.current);

    const stride = parseFloat(userStride) || 0.7;
    const distance = currentStepCount.current * stride;
    setTotalDistance(distance);

    // 속도 계산 (km/h)
    if (startTime.current) {
      const elapsedHours = (Date.now() - startTime.current) / (1000 * 60 * 60);
      const distanceKm = distance / 1000;
      setCurrentSpeed(elapsedHours > 0 ? distanceKm / elapsedHours : 0);
    }

    setDebugInfo(`🚶 감지됨: ${currentStepCount.current}걸음`);

    console.log(
      `🚶 걸음 감지! x: ${x.toFixed(2)}, y: ${y.toFixed(2)}, z: ${z.toFixed(
        2
      )}, Δt: ${(timeDiff / 1000).toFixed(2)}s`
    );
  };

  const saveRecord = () => {
    if (stepCount === 0) {
      Alert.alert("저장 실패", "걸음 수가 없습니다.");
      return;
    }

    const record = {
      id: Date.now(),
      date: new Date().toLocaleString("ko-KR"),
      steps: stepCount,
      distance: totalDistance,
      time: currentTime,
      speed: currentSpeed,
    };

    setSavedRecords((prev) => [record, ...prev]);
    Alert.alert(
      "저장 완료",
      `${stepCount}걸음, ${(totalDistance / 1000).toFixed(2)}km 저장됨`
    );
  };

  const resetData = () => {
    Alert.alert("초기화", "모든 데이터를 초기화하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "초기화",
        style: "destructive",
        onPress: () => {
          stopTracking();
          currentStepCount.current = 0;
          setStepCount(0);
          setTotalDistance(0);
          setCurrentTime("00:00");
          setCurrentSpeed(0);
          startTime.current = null;
          setDebugInfo("🔁 초기화 완료");
        },
      },
    ]);
  };

  const updateUserSettings = () => {
    if (!userGender || !userAge || !userStride) {
      Alert.alert("입력 오류", "모든 항목을 입력하세요.");
      return;
    }

    const stride = parseFloat(userStride);
    if (isNaN(stride) || stride < 0.1 || stride > 2.0) {
      Alert.alert("보폭 오류", "보폭은 0.1~2.0m 사이여야 합니다.");
      return;
    }

    setShowSettings(false);
    Alert.alert(
      "설정 완료",
      `${userGender === "male" ? "남성" : "여성"}, ${userAge}세, ${userStride}m`
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Running</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsButtonText}>설정</Text>
        </TouchableOpacity>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>시간</Text>
          <Text style={styles.statusValue}>{currentTime}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>속도</Text>
          <Text style={styles.statusValue}>{currentSpeed.toFixed(1)} km/h</Text>
        </View>
      </View>

      {/* Main Display */}
      <View style={styles.mainDisplay}>
        <Text style={styles.timeDisplay}>{currentTime}</Text>
        <Text style={styles.speedDisplay}>{currentSpeed.toFixed(1)} km/h</Text>
        <Text style={styles.yearDisplay}>2024</Text>

        <View style={styles.speedCircle}>
          <Text style={styles.speedCircleText}>
            {currentSpeed.toFixed(1)} km/h
          </Text>
        </View>

        <View style={styles.distanceContainer}>
          <Text style={styles.distanceValue}>
            {(totalDistance / 1000).toFixed(2)}
          </Text>
          <Text style={styles.distanceLabel}>Kilometers</Text>
        </View>

        <View style={styles.stepsContainer}>
          <Text style={styles.stepsIcon}>👟</Text>
          <Text style={styles.stepsValue}>+{stepCount}</Text>
        </View>
      </View>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <TouchableOpacity style={styles.controlButton} onPress={saveRecord}>
          <View style={styles.controlButtonInner}>
            <Text style={styles.controlButtonText}>💾</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.mainControlButton]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <View
            style={[styles.controlButtonInner, styles.mainControlButtonInner]}
          >
            <Text style={styles.mainControlButtonText}>
              {isTracking ? "⏸" : "▶️"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={resetData}>
          <View style={styles.controlButtonInner}>
            <Text style={styles.controlButtonText}>🔄</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Debug Info (Hidden in production) */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            가속도: x:{accelerometerData.x.toFixed(2)} y:
            {accelerometerData.y.toFixed(2)} z:{accelerometerData.z.toFixed(2)}
          </Text>
          <Text style={styles.debugText}>상태: {debugInfo}</Text>
        </View>
      )}

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>사용자 설정</Text>

            <Text style={styles.inputLabel}>성별</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  userGender === "male" && styles.selectedGender,
                ]}
                onPress={() => setUserGender("male")}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    userGender === "male" && styles.selectedGenderText,
                  ]}
                >
                  남성
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  userGender === "female" && styles.selectedGender,
                ]}
                onPress={() => setUserGender("female")}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    userGender === "female" && styles.selectedGenderText,
                  ]}
                >
                  여성
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>나이</Text>
            <TextInput
              style={styles.input}
              value={userAge}
              onChangeText={setUserAge}
              keyboardType="numeric"
              placeholder="나이를 입력하세요"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>보폭 (미터)</Text>
            <TextInput
              style={styles.input}
              value={userStride}
              onChangeText={setUserStride}
              keyboardType="numeric"
              placeholder="예: 0.7"
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={updateUserSettings}
              >
                <Text style={styles.confirmButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 24,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#333",
    borderRadius: 15,
  },
  settingsButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  statusItem: {
    alignItems: "center",
  },
  statusLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  mainDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  timeDisplay: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  speedDisplay: {
    color: "#888",
    fontSize: 16,
    marginBottom: 20,
  },
  yearDisplay: {
    color: "#888",
    fontSize: 16,
    marginBottom: 30,
  },
  speedCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  speedCircleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  distanceContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  distanceValue: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "bold",
  },
  distanceLabel: {
    color: "#888",
    fontSize: 16,
    marginTop: 4,
  },
  stepsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stepsIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  stepsValue: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
  },
  controlPanel: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 40,
    backgroundColor: "#4ECDC4",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 30,
  },
  controlButton: {
    width: 60,
    height: 60,
    marginHorizontal: 20,
  },
  controlButtonInner: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonText: {
    fontSize: 24,
  },
  mainControlButton: {
    width: 80,
    height: 80,
  },
  mainControlButtonInner: {
    borderRadius: 40,
    backgroundColor: "#fff",
  },
  mainControlButtonText: {
    fontSize: 32,
  },
  debugContainer: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 8,
  },
  debugText: {
    color: "#fff",
    fontSize: 12,
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#2a2a2a",
    margin: 20,
    padding: 30,
    borderRadius: 20,
    width: width * 0.85,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  inputLabel: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 10,
    fontWeight: "600",
  },
  genderRow: {
    flexDirection: "row",
    marginBottom: 25,
    gap: 10,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
  },
  selectedGender: {
    backgroundColor: "#4CAF50",
  },
  genderButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  selectedGenderText: {
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#3a3a3a",
    color: "#fff",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
