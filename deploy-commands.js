// 슬래시 커맨드를 Discord에 등록하는 1회성 스크립트
// 실행: node deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
  require('./commands/attendance').data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('슬래시 커맨드 등록 중...');
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID,
      ),
      { body: commands },
    );
    console.log('✅ 슬래시 커맨드 등록 완료');
  } catch (error) {
    console.error('❌ 등록 실패:', error);
  }
})();
