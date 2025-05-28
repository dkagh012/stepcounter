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
} from "react-native";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";

export default function App() {
  const [stepCount, setStepCount] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [calculatedStride, setCalculatedStride] = useState(0);
  const [debugInfo, setDebugInfo] = useState("Initializing...");
  const [accelerometerData, setAccelerometerData] = useState({
    x: 0,
    y: 0,
    z: 0,
  });

  // 새로 추가된 상태들
  const [isTracking, setIsTracking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userGender, setUserGender] = useState(""); // "male" or "female"
  const [userAge, setUserAge] = useState("");
  const [userStride, setUserStride] = useState(""); // 사용자 입력 보폭
  const [savedRecords, setSavedRecords] = useState([]);

  const previousPositions = useRef([]);
  const currentStepCount = useRef(0);
  const accelerometerSubscription = useRef(null);
  const locationSubscription = useRef(null);
  const lastAccelValue = useRef(0);
  const isPeak = useRef(false);

  const stepThreshold = 1.2;

  // 성별과 나이에 따른 평균 보폭 계산 함수 삭제
  // 사용자가 직접 입력하도록 변경

  useEffect(() => {
    const initialize = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDebugInfo("위치 권한이 없습니다.");
        return;
      }
      setDebugInfo("위치 권한 허용됨. 설정을 완료하고 시작 버튼을 눌러주세요.");
    };

    initialize();

    return () => {
      stopTracking();
    };
  }, []);

  const startTracking = async () => {
    if (!userGender || !userAge || !userStride) {
      Alert.alert("설정 필요", "성별, 나이, 보폭을 모두 설정해주세요.");
      return;
    }

    setIsTracking(true);
    setDebugInfo("측정 시작됨...");

    // 원래 코드의 가속도계 로직 그대로 사용
    accelerometerSubscription.current = Accelerometer.addListener((data) => {
      setAccelerometerData(data);
      const { x, y, z } = data;
      const acceleration = Math.sqrt(x * x + y * y + z * z);

      if (
        acceleration > stepThreshold &&
        acceleration > lastAccelValue.current &&
        !isPeak.current
      ) {
        isPeak.current = true;
        handleStep();
      } else if (acceleration < stepThreshold && isPeak.current) {
        isPeak.current = false;
      }

      lastAccelValue.current = acceleration;
    });

    Accelerometer.setUpdateInterval(100);
  };

  const stopTracking = () => {
    setIsTracking(false);
    setDebugInfo("측정 정지됨");

    if (accelerometerSubscription.current) {
      accelerometerSubscription.current.remove();
      accelerometerSubscription.current = null;
    }
  };

  const handleStep = () => {
    if (!isTracking) return;

    currentStepCount.current += 1;
    setStepCount(currentStepCount.current);

    // 사용자 입력 보폭을 사용해서 거리 계산
    const strideDistance = parseFloat(userStride) || 0.7;
    setTotalDistance(currentStepCount.current * strideDistance);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  const saveRecord = () => {
    if (stepCount === 0) {
      Alert.alert("저장 불가", "측정된 데이터가 없습니다.");
      return;
    }

    const record = {
      id: Date.now(),
      date: new Date().toLocaleString("ko-KR"),
      steps: stepCount,
      distance: totalDistance,
      stride: parseFloat(userStride),
      duration: "측정됨", // 실제로는 시간 측정 로직 추가 필요
    };

    setSavedRecords((prev) => [record, ...prev]);
    Alert.alert(
      "저장 완료",
      `${stepCount}걸음, ${totalDistance.toFixed(2)}m가 저장되었습니다.`
    );
  };

  const resetData = () => {
    Alert.alert("초기화 확인", "모든 측정 데이터를 초기화하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "초기화",
        style: "destructive",
        onPress: () => {
          stopTracking();
          setStepCount(0);
          setTotalDistance(0);
          currentStepCount.current = 0;
          previousPositions.current = [];
          setDebugInfo("데이터가 초기화되었습니다.");
        },
      },
    ]);
  };

  const updateUserSettings = () => {
    if (!userGender || !userAge || !userStride) {
      Alert.alert("입력 오류", "성별, 나이, 보폭을 모두 입력해주세요.");
      return;
    }

    const strideNum = parseFloat(userStride);
    if (isNaN(strideNum) || strideNum <= 0 || strideNum > 2) {
      Alert.alert("입력 오류", "보폭은 0.1~2.0m 사이의 숫자를 입력해주세요.");
      return;
    }

    setShowSettings(false);
    Alert.alert(
      "설정 완료",
      `성별: ${
        userGender === "male" ? "남성" : "여성"
      }\n나이: ${userAge}세\n보폭: ${userStride}m`
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🚶‍♂️ 걸음 측정</Text>

      {/* 사용자 설정 표시 */}
      <View style={styles.settingsDisplay}>
        <Text style={styles.settingsText}>
          {userGender && userAge && userStride
            ? `${
                userGender === "male" ? "남성" : "여성"
              }, ${userAge}세 (보폭: ${userStride}m)`
            : "설정이 필요합니다"}
        </Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.buttonText}>설정</Text>
        </TouchableOpacity>
      </View>

      {/* 측정 데이터 */}
      <View style={styles.statBox}>
        <Text style={styles.statLabel}>걸음 수</Text>
        <Text style={styles.statValue}>{stepCount}</Text>
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statLabel}>총 이동 거리 (m)</Text>
        <Text style={styles.statValue}>{totalDistance.toFixed(2)}</Text>
      </View>

      {/* 컨트롤 버튼들 */}
      <View style={styles.controlContainer}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            isTracking ? styles.stopButton : styles.startButton,
          ]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Text style={styles.buttonText}>{isTracking ? "정지" : "시작"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={saveRecord}>
          <Text style={styles.buttonText}>저장</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.resetButton]}
          onPress={resetData}
        >
          <Text style={styles.buttonText}>초기화</Text>
        </TouchableOpacity>
      </View>

      {/* 저장된 기록 */}
      {savedRecords.length > 0 && (
        <View style={styles.recordsContainer}>
          <Text style={styles.recordsTitle}>저장된 기록</Text>
          {savedRecords.slice(0, 3).map((record) => (
            <View key={record.id} style={styles.recordItem}>
              <Text style={styles.recordText}>
                {record.date} - {record.steps}걸음, {record.distance.toFixed(2)}
                m
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 디버그 정보 */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>상태: {debugInfo}</Text>
        <Text style={styles.debugText}>
          가속도: x={accelerometerData.x.toFixed(2)} y=
          {accelerometerData.y.toFixed(2)} z={accelerometerData.z.toFixed(2)}
        </Text>
      </View>

      {/* 설정 모달 */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>사용자 설정</Text>

            <Text style={styles.inputLabel}>성별</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  userGender === "male" && styles.selectedGender,
                ]}
                onPress={() => setUserGender("male")}
              >
                <Text style={styles.genderText}>남성</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  userGender === "female" && styles.selectedGender,
                ]}
                onPress={() => setUserGender("female")}
              >
                <Text style={styles.genderText}>여성</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>나이</Text>
            <TextInput
              style={styles.input}
              value={userAge}
              onChangeText={setUserAge}
              placeholder="나이를 입력하세요"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>보폭 (미터)</Text>
            <TextInput
              style={styles.input}
              value={userStride}
              onChangeText={setUserStride}
              placeholder="보폭을 입력하세요 (예: 0.7)"
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.buttonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={updateUserSettings}
              >
                <Text style={styles.buttonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
  },
  settingsDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    width: "100%",
  },
  settingsText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
  },
  settingsButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  statBox: {
    alignItems: "center",
    marginBottom: 20,
  },
  statLabel: {
    fontSize: 18,
    color: "#555",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
  },
  controlContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#FF5722",
  },
  resetButton: {
    backgroundColor: "#9E9E9E",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  recordsContainer: {
    width: "100%",
    marginBottom: 20,
  },
  recordsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  recordItem: {
    padding: 10,
    backgroundColor: "#f0f0f0",
    marginBottom: 5,
    borderRadius: 5,
  },
  recordText: {
    fontSize: 12,
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f0f0f0",
    width: "100%",
    borderRadius: 10,
  },
  debugText: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: "bold",
  },
  genderContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  genderButton: {
    flex: 1,
    padding: 15,
    margin: 5,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    alignItems: "center",
  },
  selectedGender: {
    backgroundColor: "#007AFF",
  },
  genderText: {
    fontSize: 16,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modalButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#9E9E9E",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
  },
});
