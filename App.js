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
  const isTrackingRef = useRef(false);
  const currentStepCount = useRef(0);
  const accelerometerSubscription = useRef(null);
  const lastStepTime = useRef(Date.now());
  const lastAcceleration = useRef(0);
  const isPeak = useRef(false);

  const stepThreshold = 1.2;
  const stepInterval = 300;

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
    setTotalDistance(currentStepCount.current * stride);
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
    };

    setSavedRecords((prev) => [record, ...prev]);
    Alert.alert(
      "저장 완료",
      `${stepCount}걸음, ${totalDistance.toFixed(2)}m 저장됨`
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🚶 측정기</Text>

      <View style={styles.settingsBox}>
        <Text>
          {userGender && userAge && userStride
            ? `${
                userGender === "male" ? "남성" : "여성"
              } / ${userAge}세 / ${userStride}m`
            : "설정이 필요합니다"}
        </Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.btnText}>설정</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statLabel}>걸음 수</Text>
        <Text style={styles.statValue}>{stepCount}</Text>
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statLabel}>거리 (m)</Text>
        <Text style={styles.statValue}>{totalDistance.toFixed(2)}</Text>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, isTracking ? styles.stopBtn : styles.startBtn]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Text style={styles.btnText}>{isTracking ? "정지" : "시작"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={saveRecord}>
          <Text style={styles.btnText}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.resetBtn]}
          onPress={resetData}
        >
          <Text style={styles.btnText}>초기화</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.debug}>
        📡 가속도 x:{accelerometerData.x.toFixed(2)} y:
        {accelerometerData.y.toFixed(2)} z:{accelerometerData.z.toFixed(2)}
      </Text>
      <Text style={styles.debug}>🛠 상태: {debugInfo}</Text>

      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalBox}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>사용자 설정</Text>

            <Text>성별</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  userGender === "male" && styles.selectedGender,
                ]}
                onPress={() => setUserGender("male")}
              >
                <Text>남성</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  userGender === "female" && styles.selectedGender,
                ]}
                onPress={() => setUserGender("female")}
              >
                <Text>여성</Text>
              </TouchableOpacity>
            </View>

            <Text>나이</Text>
            <TextInput
              style={styles.input}
              value={userAge}
              onChangeText={setUserAge}
              keyboardType="numeric"
            />

            <Text>보폭 (미터)</Text>
            <TextInput
              style={styles.input}
              value={userStride}
              onChangeText={setUserStride}
              keyboardType="numeric"
              placeholder="예: 0.7"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={updateUserSettings}>
                <Text>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 20 },
  settingsBox: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  settingsBtn: {
    marginLeft: 10,
    backgroundColor: "#007AFF",
    padding: 8,
    borderRadius: 5,
  },
  statBox: { alignItems: "center", marginVertical: 10 },
  statLabel: { fontSize: 16, color: "#666" },
  statValue: { fontSize: 28, fontWeight: "bold" },
  btnRow: { flexDirection: "row", marginTop: 20 },
  btn: {
    padding: 12,
    marginHorizontal: 5,
    backgroundColor: "#333",
    borderRadius: 6,
  },
  startBtn: { backgroundColor: "#4CAF50" },
  stopBtn: { backgroundColor: "#E53935" },
  resetBtn: { backgroundColor: "#999" },
  btnText: { color: "#fff" },
  debug: { fontSize: 12, color: "#444", marginTop: 5 },
  modalBox: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    margin: 30,
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  genderRow: { flexDirection: "row", marginBottom: 10 },
  genderBtn: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#eee",
    margin: 5,
  },
  selectedGender: { backgroundColor: "#007AFF" },
  input: { borderWidth: 1, padding: 10, marginVertical: 10, borderRadius: 6 },
  modalBtns: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
});
