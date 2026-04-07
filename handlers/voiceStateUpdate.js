const { TARGET_VOICE_CHANNEL_ID } = require('../config');
const { upsertMember, logActivity } = require('../db/queries');

module.exports = function handleVoiceStateUpdate(oldState, newState) {
  try {
    // 채널 이탈 시 newState.member가 null일 수 있으므로 oldState.member로 폴백
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    // 지정된 스터디 음성 채널만 추적
    const channelId = newState.channelId ?? oldState.channelId;
    if (channelId !== TARGET_VOICE_CHANNEL_ID) return;

    const discordUserId = member.user.id;
    const username = member.displayName ?? member.user.username;

    // 변화 감지
    const camChanged = oldState.selfVideo !== newState.selfVideo;
    const screenChanged = oldState.streaming !== newState.streaming;
    if (!camChanged && !screenChanged) return;

    const { id: memberId } = upsertMember(discordUserId, username);

    if (camChanged) {
      const action = newState.selfVideo ? 'on' : 'off';
      logActivity(memberId, 'cam', action);
      console.log(`[cam ${action}] ${username}`);
    }

    if (screenChanged) {
      const action = newState.streaming ? 'on' : 'off';
      logActivity(memberId, 'screen', action);
      console.log(`[screen ${action}] ${username}`);
    }
  } catch (error) {
    console.error('[voiceStateUpdate] 처리 오류:', error);
  }
};
