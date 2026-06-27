import { create } from 'zustand';

export interface MissionState {
  showGForce: boolean;
  toggleGForce: () => void;
  logs: string[];
  addLog: (msg: string) => void;
  distanceTraveled: number;
  addDistance: (d: number) => void;
  maxSpeed: number;
  updateMaxSpeed: (s: number) => void;
  flightTime: number;
  addFlightTime: (t: number) => void;
  batteryDepleted: boolean;
  setBatteryDepleted: (d: boolean) => void;
  resetMission: () => void;
}

export const useMissionStore = create<MissionState>((set) => ({
  showGForce: true,
  toggleGForce: () => set((s) => ({ showGForce: !s.showGForce })),
  logs: [],
  addLog: (msg) => set((s) => {
    const newLog = `[${new Date().toLocaleTimeString()}] ${msg}`;
    // Keep last 50 logs
    const newLogs = [...s.logs, newLog].slice(-50);
    return { logs: newLogs };
  }),
  distanceTraveled: 0,
  addDistance: (d) => set((s) => ({ distanceTraveled: s.distanceTraveled + d })),
  maxSpeed: 0,
  updateMaxSpeed: (s) => set((state) => ({ maxSpeed: Math.max(state.maxSpeed, s) })),
  flightTime: 0,
  addFlightTime: (t) => set((s) => ({ flightTime: s.flightTime + t })),
  batteryDepleted: false,
  setBatteryDepleted: (d) => set({ batteryDepleted: d }),
  resetMission: () => set({ logs: [], distanceTraveled: 0, maxSpeed: 0, flightTime: 0, batteryDepleted: false })
}));
