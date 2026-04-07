const db = require('./database');

/**
 * 스터디원 upsert — 없으면 INSERT, 있으면 username 갱신
 */
function upsertMember(discordUserId, username) {
  db.prepare(`
    INSERT INTO members (discord_user_id, username, created_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(discord_user_id) DO UPDATE SET username = excluded.username
  `).run(discordUserId, username);

  return db.prepare(
    'SELECT id FROM members WHERE discord_user_id = ?'
  ).get(discordUserId);
}

/**
 * 캠/화면공유 이벤트 기록
 */
function logActivity(memberId, eventType, action) {
  db.prepare(`
    INSERT INTO activity_logs (member_id, event_type, action, timestamp)
    VALUES (?, ?, ?, datetime('now'))
  `).run(memberId, eventType, action);
}

/**
 * 특정 날짜(KST YYYY-MM-DD)의 activity_logs 조회
 * timestamp는 UTC로 저장되므로 +9시간 변환하여 날짜 필터링
 */
function getActivityByDate(date, memberId = null) {
  const base = `
    SELECT al.*, m.discord_user_id, m.username
    FROM activity_logs al
    JOIN members m ON al.member_id = m.id
    WHERE date(datetime(al.timestamp, '+9 hours')) = ?
  `;
  if (memberId) {
    return db.prepare(base + ' AND al.member_id = ? ORDER BY al.timestamp').all(date, memberId);
  }
  return db.prepare(base + ' ORDER BY al.timestamp').all(date);
}

/**
 * 전체 스터디원 목록
 */
function getAllMembers() {
  return db.prepare('SELECT * FROM members ORDER BY created_at').all();
}

module.exports = { upsertMember, logActivity, getActivityByDate, getAllMembers };
