const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getActivityByDate, getAllMembers } = require("../db/queries");
const config = require("../config");

// ── 상수 ──────────────────────────────────────────────────
const STUDY_START_HOUR = 20; // KST
const STUDY_END_HOUR = 22; // KST
const COLOR = { NORMAL: 0x3498db, WARN: 0xf1c40f, ABSENT: 0x95a5a6 };

// ── 슬래시 커맨드 정의 ────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName("출석기록")
  .setDescription("날짜별 캠/화면공유 기록 조회")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt
      .setName("대상")
      .setDescription("특정 유저 (기본값: 전체)")
      .setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName("날짜")
      .setDescription("YYYY-MM-DD (기본값: 오늘)")
      .setRequired(false),
  );

// ── 유틸 ─────────────────────────────────────────────────

/** UTC ISO 문자열 → KST HH:MM 문자열 */
function toKstTime(utcStr) {
  const d = new Date(utcStr.replace(" ", "T") + "Z");
  d.setHours(d.getHours() + 9);
  return d.toISOString().slice(11, 16); // HH:MM
}

/** UTC ISO 문자열 → KST Date 객체 */
function toKstDate(utcStr) {
  const d = new Date(utcStr.replace(" ", "T") + "Z");
  d.setHours(d.getHours() + 9);
  return d;
}

/** 분 차이 계산 */
function diffMinutes(a, b) {
  return Math.floor((b - a) / 60000);
}

/** 분 → "Xh Ym" 표시 */
function formatDuration(minutes) {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── 이벤트 리스트 파싱 ────────────────────────────────────

/**
 * activity_logs 행 배열에서 특정 event_type의 on/off 쌍을 만들어 반환
 * returns: { lines: string[], totalMinutes: number, firstOnKst: Date | null }
 */
function parseEvents(logs, eventType) {
  const events = logs.filter((l) => l.event_type === eventType);
  const lines = [];
  let totalMinutes = 0;
  let firstOnKst = null;
  let lastOnKst = null;

  for (const e of events) {
    const kst = toKstDate(e.timestamp);
    if (e.action === "on") {
      if (!firstOnKst) firstOnKst = kst;
      lastOnKst = kst;
      lines.push(`∙ ${toKstTime(e.timestamp)} ON`);
    } else {
      if (lastOnKst) {
        const mins = diffMinutes(lastOnKst, kst);
        totalMinutes += mins;
        lines.push(`∙ ${toKstTime(e.timestamp)} OFF (${formatDuration(mins)})`);
        lastOnKst = null;
      }
    }
  }

  // 종료 이벤트 없이 스터디 종료된 경우 — 22:00 KST 기준으로 마감
  if (lastOnKst) {
    const studyEnd = new Date(lastOnKst);
    studyEnd.setUTCHours(STUDY_END_HOUR, 0, 0, 0); // setHours는 로컬 타임존 기준이라 KST 서버에서 오작동
    if (lastOnKst < studyEnd) {
      const mins = diffMinutes(lastOnKst, studyEnd);
      totalMinutes += mins;
      lines.push(`∙ 22:00 (스터디 종료, ${formatDuration(mins)})`);
    }
  }

  if (totalMinutes > 0) lines.push(`누적: ${formatDuration(totalMinutes)}`);

  return { lines, totalMinutes, firstOnKst };
}

// ── 벌금 판정 ─────────────────────────────────────────────

/**
 * 캠+화면공유 모두 꺼진 연속 구간이 ABSENT_THRESHOLD_MINUTES 이상인지 확인
 * 스터디 시간(20:00~22:00 KST) 기준
 */
function calcAbsent(logs, dateStr) {
  // 스터디 시간 경계 (KST)
  const studyStart = new Date(
    `${dateStr}T${String(STUDY_START_HOUR).padStart(2, "0")}:00:00+09:00`,
  );
  const studyEnd = new Date(
    `${dateStr}T${String(STUDY_END_HOUR).padStart(2, "0")}:00:00+09:00`,
  );

  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp + "Z") - new Date(b.timestamp + "Z"),
  );

  // 스터디 시작 전 이벤트로 초기 상태 결정
  let camOn = false;
  let screenOn = false;
  for (const e of sorted) {
    const t = new Date(e.timestamp.replace(" ", "T") + "Z");
    if (t >= studyStart) break;
    if (e.event_type === "cam") camOn = e.action === "on";
    if (e.event_type === "screen") screenOn = e.action === "on";
  }

  let bothOffSince = camOn || screenOn ? null : studyStart;
  let absentMinutes = 0;

  for (const e of sorted) {
    const t = new Date(e.timestamp.replace(" ", "T") + "Z");
    if (t < studyStart || t > studyEnd) continue;

    const wasOff = !camOn && !screenOn;

    if (e.event_type === "cam") camOn = e.action === "on";
    if (e.event_type === "screen") screenOn = e.action === "on";

    const isOff = !camOn && !screenOn;

    if (wasOff && !isOff) {
      // 꺼진 구간 종료
      absentMinutes += diffMinutes(bothOffSince, t);
      bothOffSince = null;
    } else if (!wasOff && isOff) {
      // 꺼진 구간 시작
      bothOffSince = t;
    }
  }

  // 스터디 종료까지 꺼진 상태였다면
  if (!camOn && !screenOn && bothOffSince) {
    absentMinutes += diffMinutes(bothOffSince, studyEnd);
  }

  return absentMinutes >= config.ABSENT_THRESHOLD_MINUTES;
}

/**
 * 벌금 판정
 * returns: { penalties: string[], color: number }
 */
function calcPenalties(logs, firstOnKst, dateStr) {
  const penalties = [];
  let color = COLOR.NORMAL;

  // 첫 번째 on 이벤트 시각 (캠 or 화면공유 중 빠른 것)
  const camFirst = logs.filter(
    (l) => l.event_type === "cam" && l.action === "on",
  )[0];
  const screenFirst = logs.filter(
    (l) => l.event_type === "screen" && l.action === "on",
  )[0];

  let earliest = null;
  if (camFirst && screenFirst) {
    earliest =
      new Date(camFirst.timestamp + "Z") < new Date(screenFirst.timestamp + "Z")
        ? toKstDate(camFirst.timestamp)
        : toKstDate(screenFirst.timestamp);
  } else if (camFirst) earliest = toKstDate(camFirst.timestamp);
  else if (screenFirst) earliest = toKstDate(screenFirst.timestamp);

  // 불참 판정
  const noRecord = logs.length === 0;
  const tooLate = earliest && earliest.getHours() >= config.NO_SHOW_HOUR;

  if (noRecord || tooLate) {
    penalties.push(`불참 (${config.NO_SHOW_PENALTY.toLocaleString()}원)`);
    color = COLOR.ABSENT;
  } else if (earliest) {
    // 지각 판정 (20:01 이후)
    const startH = earliest.getHours();
    const startM = earliest.getMinutes();
    const isLate =
      startH > STUDY_START_HOUR ||
      (startH === STUDY_START_HOUR && startM >= config.LATE_START_MINUTE);
    if (isLate) {
      penalties.push(`지각 (${config.LATE_PENALTY.toLocaleString()}원)`);
      color = COLOR.WARN;
    }
  }

  // 부재중 판정 (불참·지각과 독립)
  if (!noRecord && calcAbsent(logs, dateStr)) {
    penalties.push(`부재중 (${config.ABSENT_PENALTY.toLocaleString()}원)`);
    if (color === COLOR.NORMAL) color = COLOR.WARN;
  }

  return { penalties, color };
}

// ── Embed 생성 ────────────────────────────────────────────

function buildEmbed(member, logs, dateStr) {
  const camResult = parseEvents(logs, "cam");
  const screenResult = parseEvents(logs, "screen");
  const { penalties, color } = calcPenalties(logs, null, dateStr);

  const camText = camResult.lines.length
    ? camResult.lines.join("\n")
    : "기록 없음";
  const screenText = screenResult.lines.length
    ? screenResult.lines.join("\n")
    : "기록 없음";
  const penaltyText = penalties.length ? penalties.join("\n") : "해당없음";

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`👤 ${member.username}`)
    .setDescription(`📋 출석 기록 | ${dateStr}`)
    .addFields(
      { name: "📷 캠", value: camText, inline: true },
      { name: "🖥️ 화면공유", value: screenText, inline: true },
      { name: "💸 벌금", value: penaltyText },
    );
}

// ── execute ───────────────────────────────────────────────

async function execute(interaction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("대상");
  const dateInput = interaction.options.getString("날짜");

  // 날짜 기본값: 오늘 KST
  const now = new Date();
  now.setHours(now.getHours() + 9);
  const dateStr = dateInput ?? now.toISOString().slice(0, 10);

  // 날짜 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return interaction.editReply(
      "❌ 날짜 형식이 올바르지 않습니다. (예: 2026-04-07)",
    );
  }

  // 조회할 멤버 목록
  const allMembers = getAllMembers();
  const targets = targetUser
    ? allMembers.filter((m) => m.discord_user_id === targetUser.id)
    : allMembers;

  if (targets.length === 0) {
    return interaction.editReply("해당 날짜에 기록이 없습니다.");
  }

  // Embed 생성
  const embeds = targets.map((member) => {
    const logs = getActivityByDate(dateStr, member.id);
    return buildEmbed(member, logs, dateStr);
  });

  // Discord는 한 번에 최대 10개 Embed 전송 가능
  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    if (i === 0) await interaction.editReply({ embeds: chunk });
    else await interaction.followUp({ embeds: chunk });
  }
}

module.exports = { data, execute, buildEmbed };
