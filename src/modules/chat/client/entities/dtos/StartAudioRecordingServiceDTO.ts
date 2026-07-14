export type StartAudioRecordingServiceDTO = {
  audioInputDeviceId?: string;
  onTick: (duration: number) => void;
  onRecorded: (recording: { blob: Blob; url: string }) => Promise<void> | void;
  onEmptyRecording: () => void;
};
