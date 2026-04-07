require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // F-02: 음성 상태 추적에 필요
  ],
});

const handleVoiceStateUpdate = require("./handlers/voiceStateUpdate");
const attendance = require("./commands/attendance");

client.once("ready", () => {
  console.log(`✅ 봇 로그인 성공: ${client.user.tag}`);
});

client.on("voiceStateUpdate", handleVoiceStateUpdate);

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === "출석기록") {
      await attendance.execute(interaction);
    }
  } catch (error) {
    console.error("커맨드 실행 오류:", error);
    const reply = { content: "❌ 오류가 발생했습니다.", ephemeral: true };
    if (interaction.deferred) await interaction.editReply(reply);
    else await interaction.reply(reply);
  }
});

client.on("error", (error) => {
  console.error("Discord 클라이언트 에러:", error);
});

// DISCORD_BOT_TOKEN 미설정 시 에러 안내
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error(
    "❌ DISCORD_BOT_TOKEN이 설정되지 않았습니다. .env 파일을 확인하세요.",
  );
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("Discord 로그인 실패:", error.message);
  process.exit(1);
});
