module.exports = {
  ALARM_CHANNEL_ID: "1487015692250386582", // 알람 공지 채널
  RECORD_CHANNEL_ID: "1478377721817206875", // 출석기록 채널
  TARGET_VOICE_CHANNEL_ID: "1477980399119372429", // 추적할 스터디 음성 채널

  // 알람 스케줄 (KST 기준, 서버 타임존이 Asia/Seoul이어야 함)
  ALARM_SCHEDULES: [
    { label: "시작", cron: "0 20 * * 1,2,4" }, // 월·화·목 20:00
    { label: "종료", cron: "0 22 * * 1,2,4" }, // 월·화·목 22:00
  ],

  // 벌금 판정 기준
  LATE_START_MINUTE: 1, // 스터디 시작 후 N분 초과 시 지각 (20:01~)
  NO_SHOW_HOUR: 21, // N시 이후 참여 시 불참 처리 (기록이 전혀 없는 경우도 불참)
  ABSENT_THRESHOLD_MINUTES: 20, // 캠·화면공유 꺼진 상태 N분 이상 지속 시 부재중

  // 벌금 금액 (원)
  LATE_PENALTY: 1000,
  ABSENT_PENALTY: 1000,
  NO_SHOW_PENALTY: 3000,

  // F-04 자동 리포트 스케줄 (월·화·목 22:01 KST)
  REPORT_SCHEDULE: "1 22 * * 1,2,4",
};
