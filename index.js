require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // F-02: 음성 상태 추적에 필요
  ],
});

const handleVoiceStateUpdate = require('./handlers/voiceStateUpdate');

client.once('ready', () => {
  console.log(`✅ 봇 로그인 성공: ${client.user.tag}`);
});

client.on('voiceStateUpdate', handleVoiceStateUpdate);

client.on('error', (error) => {
  console.error('Discord 클라이언트 에러:', error);
});

// DISCORD_BOT_TOKEN 미설정 시 에러 안내
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN이 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error('Discord 로그인 실패:', error.message);
  process.exit(1);
});
