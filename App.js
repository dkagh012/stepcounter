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
  const [heartRate, setHeartRate] = useState(0);

  const isTrackingRef = useRef(false);
  const currentStepCount = useRef(0);
  const accelerometerSubscription = useRef(null);
  const lastStepTime = useRef(Date.now());
  const lastAcceleration = useRef(0);
  const isPeak = useRef(false);
  const startTime = useRef(null);
  const timeInterval = useRef(null);
  const heartRateInterval = useRef(null);

  // 임계값을 계산합니다 현재 1.2 이상으로 되어 있으니 가속도를 계산하였을떄 1.2 이상으로 올라야 1걸음이 증가합니다
  const stepThreshold = 1.2;

  // 사람의 걸음으로 했을떄 0.3초 이후 다시 계산 될 수 있는 타이머입니다.
  const stepInterval = 400;

  // 심박수 시뮬레이션 (실제 앱에서는 센서 데이터 사용)
  useEffect(() => {
    if (isTracking) {
      heartRateInterval.current = setInterval(() => {
        // 운동 중 심박수 시뮬레이션 (120-160 bpm)
        const baseRate = 120;
        const variation = Math.random() * 40;
        setHeartRate(Math.round(baseRate + variation));
      }, 2000);
    } else {
      if (heartRateInterval.current) {
        clearInterval(heartRateInterval.current);
      }
      setHeartRate(0);
    }

    return () => {
      if (heartRateInterval.current) {
        clearInterval(heartRateInterval.current);
      }
    };
  }, [isTracking]);

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
          setHeartRate(0);
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

  // 진행률 계산 (예: 목표 거리 5km 기준)
  const targetDistance = 5; // 5km 목표
  const progressPercentage = Math.min(
    (totalDistance / 1000 / targetDistance) * 100,
    100
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>러닝</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Heart Rate Display */}
      {userGender === "male" ? (
        <View style={styles.heartRateContainer}>
          <Text style={styles.heartRateUnit}>성별 :</Text>
          <Text style={styles.heartRateValue}>
            {userGender === "male" ? "남성" : "여성"}
          </Text>
        </View>
      ) : (
        <View style={styles.heartRateContainer}>
          <Text style={styles.heartRateUnit}>성별 설정을 해주세요</Text>
        </View>
      )}

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercentage}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {stepCount}
          {(totalDistance / 1000).toFixed(1)} / {targetDistance}.0 km
        </Text>
      </View>

      {/* Main Display */}
      <View style={styles.mainDisplay}>
        <View style={styles.stepDisplay}>
          <Text style={styles.stepCount}>{stepCount}</Text>
          <Text style={styles.stepText}>걸음 수</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {(totalDistance / 1000).toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>거리 (km)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userStride ? userStride : 0}</Text>
            <Text style={styles.statLabel}>보폭 (m)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentTime}</Text>
            <Text style={styles.statLabel}>시간</Text>
          </View>
        </View>
      </View>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <TouchableOpacity
          style={styles.smallControlButton}
          onPress={saveRecord}
        >
          <Text style={styles.smallControlButtonText}>💾</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainControlButton, isTracking && styles.pauseButton]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <View style={styles.mainControlButtonInner}>
            {isTracking ? (
              <View style={styles.pauseIcon}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : (
              <Text style={styles.playIcon}>▶️</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallControlButton} onPress={resetData}>
          <Text style={styles.smallControlButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

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
              placeholderTextColor="#666"
            />

            <Text style={styles.inputLabel}>보폭 (미터)</Text>
            <TextInput
              style={styles.input}
              value={userStride}
              onChangeText={setUserStride}
              keyboardType="numeric"
              placeholder="예: 0.7"
              placeholderTextColor="#666"
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
    backgroundColor: "#0a0a0a",
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
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButtonText: {
    fontSize: 20,
  },
  heartRateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    backgroundColor: "#1a1a1a",
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
  },
  heartRateIcon: {
    marginRight: 10,
  },
  heartRateIconText: {
    fontSize: 20,
  },
  heartRateValue: {
    color: "#00ff88",
    fontWeight: "bold",
    marginRight: 5,
  },
  heartRateUnit: {
    color: "#00ff88",
    fontSize: 16,
    fontWeight: "600",
  },
  progressContainer: {
    marginHorizontal: 20,
    marginBottom: 40,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00ff88",
    borderRadius: 3,
  },
  progressText: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
  },
  mainDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  stepDisplay: {
    fontWeight: "300",
    marginBottom: 60,
  },
  stepCount: {
    color: "#fff",
    fontSize: 72,
    fontWeight: "300",
    fontFamily: "monospace",
  },
  stepText: {
    color: "#00ff88",
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 5,
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#333",
  },
  controlPanel: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 50,
    paddingTop: 30,
  },
  smallControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 30,
  },
  smallControlButtonText: {
    fontSize: 20,
  },
  mainControlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#00ff88",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButton: {
    backgroundColor: "#ff4444",
  },
  mainControlButtonInner: {
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    fontSize: 28,
    color: "#000",
    marginLeft: 3,
  },
  pauseIcon: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseBar: {
    width: 4,
    height: 20,
    backgroundColor: "#fff",
    marginHorizontal: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
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
    backgroundColor: "#333",
    alignItems: "center",
  },
  selectedGender: {
    backgroundColor: "#00ff88",
  },
  genderButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  selectedGenderText: {
    color: "#000",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#333",
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
    backgroundColor: "#00ff88",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  confirmButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
});
