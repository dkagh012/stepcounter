import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
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
  const [mode, setMode] = useState("walk"); // "walk" or "run"

  const previousPositions = useRef([]);
  const currentStepCount = useRef(0);
  const accelerometerSubscription = useRef(null);
  const lastAccelValue = useRef(0);
  const lastStepTime = useRef(0);
  const isPeak = useRef(false);

  const stepThreshold = 1.2;

  useEffect(() => {
    const initialize = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDebugInfo("위치 권한이 없습니다.");
        return;
      }

      setDebugInfo("위치 권한 허용됨. 측정 시작...");
      startTracking();
    };

    initialize();

    return () => {
      if (accelerometerSubscription.current) {
        accelerometerSubscription.current.remove();
      }
    };
  }, []);

  const startTracking = async () => {
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 0.1,
        timeInterval: 100,
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        if (previousPositions.current.length === 0) {
          previousPositions.current.push({ latitude, longitude });
        }
      }
    );

    accelerometerSubscription.current = Accelerometer.addListener((data) => {
      setAccelerometerData(data);
      const { x, y, z } = data;
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      const MIN_STEP_INTERVAL = mode === "walk" ? 450 : 150;

      if (
        acceleration > stepThreshold &&
        acceleration > lastAccelValue.current &&
        !isPeak.current &&
        now - lastStepTime.current > MIN_STEP_INTERVAL
      ) {
        isPeak.current = true;
        lastStepTime.current = now;
        handleStep();
      } else if (acceleration < stepThreshold && isPeak.current) {
        isPeak.current = false;
      }

      lastAccelValue.current = acceleration;
    });

    Accelerometer.setUpdateInterval(100);
  };

  const handleStep = async () => {
    currentStepCount.current += 1;
    setStepCount(currentStepCount.current);

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    const { latitude, longitude } = location.coords;

    if (previousPositions.current.length > 0) {
      const last =
        previousPositions.current[previousPositions.current.length - 1];
      const distance = calculateDistance(
        last.latitude,
        last.longitude,
        latitude,
        longitude
      );

      if (distance > 0.2) {
        previousPositions.current.push({ latitude, longitude });
        setTotalDistance((prev) => {
          const newTotal = prev + distance;
          const newStride = newTotal / currentStepCount.current;
          setCalculatedStride(newStride);
          return newTotal;
        });
      }
    } else {
      previousPositions.current.push({ latitude, longitude });
    }
  };

  const resetTracking = () => {
    currentStepCount.current = 0;
    previousPositions.current = [];
    setStepCount(0);
    setTotalDistance(0);
    setCalculatedStride(0);
    setDebugInfo("초기화 완료. 다시 시작하려면 걷거나 뛰세요.");
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.modeSwitch}>
        <TouchableOpacity
          onPress={() => setMode((prev) => (prev === "walk" ? "run" : "walk"))}
          style={styles.modeButton}
        >
          <Text style={styles.modeButtonText}>
            현재 모드: {mode === "walk" ? "🚶 걷기" : "🏃 달리기"} (클릭 시
            전환)
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={resetTracking} style={styles.resetButton}>
        <Text style={styles.resetButtonText}>🔄 초기화</Text>
      </TouchableOpacity>

      <Text style={styles.title}>실시간 걸음 측정</Text>

      <View style={styles.statBox}>
        <Text style={styles.statLabel}>걸음 수</Text>
        <Text style={styles.statValue}>{stepCount}</Text>
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statLabel}>총 이동 거리 (m)</Text>
        <Text style={styles.statValue}>{totalDistance.toFixed(2)}</Text>
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statLabel}>평균 보폭 (m)</Text>
        <Text style={styles.statValue}>{calculatedStride.toFixed(2)}</Text>
      </View>

      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>디버그: {debugInfo}</Text>
        <Text style={styles.debugText}>
          가속도: x={accelerometerData.x.toFixed(2)} y=
          {accelerometerData.y.toFixed(2)} z={accelerometerData.z.toFixed(2)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 30,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  modeSwitch: {
    width: "100%",
    marginBottom: 10,
    alignItems: "center",
  },
  modeButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 8,
  },
  modeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  resetButton: {
    backgroundColor: "#FF3B30",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  resetButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
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
  debugContainer: {
    marginTop: 30,
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
});
