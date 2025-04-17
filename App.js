import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
} from "react-native";
import { Accelerometer } from "expo-sensors";

const STEP_DIFF_MIN = 0.07;
const THRESHOLD_WINDOW = 50;
const STEP_MIN_INTERVAL_MS = 400;
const MAX_Z_JUMP = 1.5;
const MAX_VALID_MAGNITUDE = 3;

export default function StepTracker() {
  const [isTracking, setIsTracking] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [autoDistance, setAutoDistance] = useState(0);
  const [manualDistance, setManualDistance] = useState(0);
  const [log, setLog] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [manualStride, setManualStride] = useState("0.7");
  const [useManualStride, setUseManualStride] = useState(false);
  const [lastAutoStride, setLastAutoStride] = useState(0.7);
  const [diffMessage, setDiffMessage] = useState("");

  const accelData = useRef([]);
  const thresholdWindow = useRef([]);
  const lastStepTime = useRef(0);
  const intervalHistory = useRef([]);

  const appendLog = (msg) => {
    console.log(msg);
    setLog((prev) => [msg, ...prev.slice(0, 100)]);
  };

  useEffect(() => {
    let subscription;

    if (isTracking) {
      subscription = Accelerometer.addListener((data) => {
        const { x, y, z } = data;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const timestamp = Date.now();

        accelData.current.push({ x, y, z, time: timestamp });

        if (accelData.current.length >= 3) {
          const prev = accelData.current[accelData.current.length - 3];
          const mid = accelData.current[accelData.current.length - 2];
          const next = accelData.current[accelData.current.length - 1];

          const midMag = Math.sqrt(mid.x ** 2 + mid.y ** 2 + mid.z ** 2);
          const prevMag = Math.sqrt(prev.x ** 2 + prev.y ** 2 + prev.z ** 2);
          const nextMag = Math.sqrt(next.x ** 2 + next.y ** 2 + next.z ** 2);

          thresholdWindow.current.push(midMag);
          if (thresholdWindow.current.length > THRESHOLD_WINDOW) {
            thresholdWindow.current.shift();
          }

          const avg =
            thresholdWindow.current.reduce((a, b) => a + b, 0) /
            thresholdWindow.current.length;
          const stepThreshold = avg + 0.05;

          const dz = Math.abs(mid.z - prev.z);
          const interval = mid.time - lastStepTime.current;

          if (interval < 2000) {
            intervalHistory.current.push(interval);
            if (intervalHistory.current.length > 5) {
              intervalHistory.current.shift();
            }
          }

          const avgInterval =
            intervalHistory.current.reduce((a, b) => a + b, 0) /
            intervalHistory.current.length;

          const isPeak =
            midMag > stepThreshold &&
            midMag > prevMag &&
            midMag > nextMag &&
            midMag - avg > STEP_DIFF_MIN;

          const isRunningNow =
            (interval < 350 && midMag > 1.3) || (avgInterval < 450 && dz > 0.7);
          setIsRunning(isRunningNow);

          if (
            isPeak &&
            dz < MAX_Z_JUMP &&
            midMag < MAX_VALID_MAGNITUDE &&
            interval > STEP_MIN_INTERVAL_MS
          ) {
            const autoStride = Math.min(Math.max(0.45 + dz * 0.4, 0.3), 1.2);
            setLastAutoStride(autoStride);

            const manualStrideVal = parseFloat(manualStride || "0.7");

            setStepCount((prev) => {
              const newCount = prev + 1;
              const autoDist = newCount * autoStride;
              const manualDist = newCount * manualStrideVal;
              setAutoDistance(autoDist);
              setManualDistance(manualDist);

              appendLog(
                `[STEP DETECTED]
• Stride: ${
                  useManualStride
                    ? manualStrideVal.toFixed(2)
                    : autoStride.toFixed(2)
                }m (${useManualStride ? "Manual" : "Auto"})
• Auto Distance: ${autoDist.toFixed(2)}m
• Manual Distance: ${manualDist.toFixed(2)}m`
              );

              return newCount;
            });

            lastStepTime.current = mid.time;
          }
        }
      });

      Accelerometer.setUpdateInterval(50);
    }

    return () => {
      subscription && subscription.remove();
    };
  }, [isTracking, useManualStride, manualStride]);

  const handleStart = () => {
    accelData.current = [];
    thresholdWindow.current = [];
    lastStepTime.current = 0;
    intervalHistory.current = [];
    setStepCount(0);
    setAutoDistance(0);
    setManualDistance(0);
    setLog([]);
    setDiffMessage("");
    setIsTracking(true);
    appendLog("[🚶‍♂️ 측정 시작]");
  };

  const handleStop = () => {
    setIsTracking(false);
    const diff = Math.abs(autoDistance - manualDistance);
    setDiffMessage(
      `🧮 자동 vs 수동 거리 차이: ${diff.toFixed(2)}m (${autoDistance.toFixed(
        2
      )}m vs ${manualDistance.toFixed(2)}m)`
    );
    appendLog("[🛑 측정 종료]");
  };

  const handleReset = () => {
    setStepCount(0);
    setAutoDistance(0);
    setManualDistance(0);
    accelData.current = [];
    thresholdWindow.current = [];
    intervalHistory.current = [];
    lastStepTime.current = 0;
    setLog([]);
    setDiffMessage("");
    appendLog("[🔄 리셋 완료]");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👟 Step Tracker</Text>
      <Text style={styles.info}>Steps: {stepCount}</Text>
      <Text style={styles.info}>자동 거리: {autoDistance.toFixed(2)} m</Text>
      <Text style={styles.info}>수동 거리: {manualDistance.toFixed(2)} m</Text>
      <Text style={styles.info}>
        현재 상태: {isRunning ? "🏃‍♂️ RUNNING" : "🚶 WALKING"}
      </Text>
      {diffMessage !== "" && (
        <Text style={[styles.info, { color: "tomato", fontWeight: "bold" }]}>
          {diffMessage}
        </Text>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>
          자동 보폭: {lastAutoStride.toFixed(2)} m
        </Text>
        <Text style={styles.label}>수동 보폭:</Text>
        <TextInput
          style={styles.input}
          value={manualStride}
          onChangeText={setManualStride}
          keyboardType="numeric"
        />
        <Text style={styles.label}>사용</Text>
        <Switch value={useManualStride} onValueChange={setUseManualStride} />
      </View>

      <View style={styles.buttonRow}>
        <Button title="시작" onPress={handleStart} disabled={isTracking} />
        <Button title="정지" onPress={handleStop} disabled={!isTracking} />
        <Button title="초기화" onPress={handleReset} />
      </View>

      <ScrollView style={styles.log}>
        {log.map((entry, index) => (
          <Text key={index} style={styles.logText}>
            {entry}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  info: { fontSize: 16, marginBottom: 6 },
  label: { fontSize: 16, marginRight: 8 },
  input: {
    width: 60,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 5,
    marginRight: 8,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  log: { flex: 1, marginTop: 10 },
  logText: { fontSize: 12, fontFamily: "monospace", marginBottom: 5 },
});
