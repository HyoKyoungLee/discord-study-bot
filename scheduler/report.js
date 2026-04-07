const cron = require('node-cron');
const { RECORD_CHANNEL_ID, REPORT_SCHEDULE } = require('../config');
const { getAllMembers, getActivityByDate } = require('../db/queries');
const { buildEmbed } = require('../commands/attendance');

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
function getTodayKst() {
  const now = new Date();
  now.setHours(now.getHours() + 9);
  return now.toISOString().slice(0, 10);
}

function registerReport(client) {
  cron.schedule(REPORT_SCHEDULE, async () => {
    try {
      const channel = await client.channels.fetch(RECORD_CHANNEL_ID);
      if (!channel?.isTextBased()) {
        console.error(`[report] 채널을 찾을 수 없거나 텍스트 채널이 아닙니다: ${RECORD_CHANNEL_ID}`);
        return;
      }

      const dateStr = getTodayKst();
      const members = getAllMembers();

      if (members.length === 0) {
        await channel.send(`📋 **${dateStr} 출석 자동 리포트**\n기록된 스터디원이 없습니다.`);
        return;
      }

      await channel.send(`📋 **${dateStr} 출석 자동 리포트**`);

      const embeds = members.map(member => {
        const logs = getActivityByDate(dateStr, member.id);
        return buildEmbed(member, logs, dateStr);
      });

      // Discord는 한 번에 최대 10개 Embed 전송 가능
      for (let i = 0; i < embeds.length; i += 10) {
        await channel.send({ embeds: embeds.slice(i, i + 10) });
      }

      console.log(`[report] ${dateStr} 자동 리포트 발송 완료`);
    } catch (error) {
      console.error('[report] 자동 리포트 발송 실패:', error);
    }
  }, { timezone: 'Asia/Seoul' });

  console.log(`[report] 자동 리포트 스케줄 등록: ${REPORT_SCHEDULE}`);
}

module.exports = { registerReport };
