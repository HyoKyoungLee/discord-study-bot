const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { ALARM_CHANNEL_ID, ALARM_SCHEDULES } = require('../config');
const { fetchQuote } = require('../utils/quote');

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** KST 기준 현재 날짜 문자열 생성: "2026년 4월 7일 월요일" */
function getKstDateString() {
  const now = new Date();
  now.setHours(now.getHours() + 9);
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const day   = now.getDate();
  const dow   = DAYS_KO[now.getDay()];
  return `${year}년 ${month}월 ${day}일 ${dow}요일`;
}

function quoteField(quote) {
  if (!quote) return '';
  return `\n\n💬 오늘의 명언\n"${quote.message}" — ${quote.author}`;
}

function buildStartEmbed(dateStr, quote) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setDescription(
      `@everyone\n\n` +
      `📅 ${dateStr} 저녁 8시에요!\n` +
      `🤓 오늘도 함께 공부해봐요!\n` +
      `🖥️ 화면공유 또는 캠을 켜주세요~` +
      quoteField(quote)
    );
}

function buildEndEmbed(dateStr, quote) {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setDescription(
      `@everyone\n\n` +
      `🏁 ${dateStr} 스터디가 종료됐어요!\n` +
      `📋 \`/출석기록\` 으로 오늘 기록을 확인해보세요.` +
      quoteField(quote)
    );
}

function registerAlarms(client) {
  for (const schedule of ALARM_SCHEDULES) {
    cron.schedule(schedule.cron, async () => {
      try {
        const channel = await client.channels.fetch(ALARM_CHANNEL_ID);
        if (!channel?.isTextBased()) {
          console.error(`[alarm] 채널을 찾을 수 없거나 텍스트 채널이 아닙니다: ${ALARM_CHANNEL_ID}`);
          return;
        }
        const dateStr = getKstDateString();
        const quote = await fetchQuote();
        const embed = schedule.label === '시작'
          ? buildStartEmbed(dateStr, quote)
          : buildEndEmbed(dateStr, quote);

        await channel.send({ content: '@everyone', embeds: [embed] });
        console.log(`[alarm] ${schedule.label} 알람 발송 완료`);
      } catch (error) {
        console.error(`[alarm] ${schedule.label} 알람 발송 실패:`, error);
      }
    }, { timezone: 'Asia/Seoul' });

    console.log(`[alarm] "${schedule.label}" 스케줄 등록: ${schedule.cron}`);
  }
}

module.exports = { registerAlarms };
